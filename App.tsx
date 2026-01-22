
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, Download, Plus, AlertCircle, Volume2, Mic2, Disc, Waves, Layers, Terminal, ListMusic, Settings2, Share2 } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio } from './services/geminiService';
import { Track, GenerationStep } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'Acoustic'];

// Sử dụng các link nhạc ổn định hơn từ Wikipedia/Wikimedia để tránh CORS
const INSTRUMENTAL_BEATS: Record<string, string> = {
  'Pop': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Ludwig_van_Beethoven_-_Symphony_No._5_in_C_minor%2C_Op._67_-_I._Allegro_con_brio.ogg',
  'Ballad': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Symphony_No._5_in_C_Minor%2C_Op._67_-_I._Allegro_con_brio.ogg',
  'Rock': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Fallback
  'EDM': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'Bolero': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'Lofi': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'Hip-hop': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'Acoustic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3'
};

// Helper functions for Manual Audio Decoding
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPCMToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.4);

  const [tracks, setTracks] = useState<(Track & { rawVocal?: string })[]>([]);
  const [currentTrack, setCurrentTrack] = useState<(Track & { rawVocal?: string, beatUrl?: string }) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [logs, setLogs] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const vocalNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-5), `[Studio] ${msg}`]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setErrorMsg('');
    setIsPlaying(false);
    stopPlayback();
    setLogs([]);

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      addLog("Khởi tạo Suno-X Engine...");
      
      const songData = await generateSongStructure(prompt, genre);
      addLog(`Sáng tác hoàn tất: ${songData.title}`);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      addLog("Đang kết nối Vocal Studio...");
      
      const rawVocalBase64 = await generateSpeechAudio(songData.lyrics, genre);
      
      if (!rawVocalBase64) {
          throw new Error("Máy chủ vocal không phản hồi. Thử lại sau!");
      }

      addLog("Vocal đã sẵn sàng. Đang đồng bộ...");

      const newTrack: Track & { rawVocal: string, beatUrl?: string } = {
        id: Date.now().toString(),
        title: songData.title,
        genre: songData.genre,
        lyrics: songData.lyrics,
        createdAt: Date.now(),
        thumbnail: `https://picsum.photos/seed/${Date.now()}/400/400`,
        rawVocal: rawVocalBase64,
        beatUrl: INSTRUMENTAL_BEATS[genre] || INSTRUMENTAL_BEATS['Pop']
      };

      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      addLog("Hoàn tất quy trình sản xuất.");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi hệ thống AI.');
      setStep(GenerationStep.IDLE);
    }
  };

  const stopPlayback = () => {
    if (vocalNodeRef.current) { try { vocalNodeRef.current.stop(); } catch(e){} vocalNodeRef.current = null; }
    if (musicNodeRef.current) { try { musicNodeRef.current.stop(); } catch(e){} musicNodeRef.current = null; }
    setIsPlaying(false);
  };

  const playMusic = async () => {
    if (!currentTrack || !currentTrack.rawVocal) return;
    initAudio();
    const ctx = audioContextRef.current!;
    if (ctx.state === 'suspended') await ctx.resume();

    stopPlayback();
    addLog("Đang tải dữ liệu mastering...");

    try {
      // 1. Giải mã Vocal thủ công từ PCM thô
      const vocalData = decodeBase64(currentTrack.rawVocal);
      const vocalBuf = await decodeRawPCMToAudioBuffer(vocalData, ctx);

      // 2. Tải Beat nền (nếu lỗi beat thì chỉ phát vocal)
      let musicBuf: AudioBuffer | null = null;
      try {
        if (currentTrack.beatUrl) {
          const res = await fetch(currentTrack.beatUrl);
          if (res.ok) {
            const arrBuf = await res.arrayBuffer();
            musicBuf = await ctx.decodeAudioData(arrBuf);
          }
        }
      } catch (beatErr) {
        console.warn("Lỗi beat nền, phát vocal đơn lẻ:", beatErr);
        addLog("Cảnh báo: Lỗi beat, phát Vocal-only.");
      }

      const vocalSource = ctx.createBufferSource();
      vocalSource.buffer = vocalBuf;

      const vGain = ctx.createGain();
      const mGain = ctx.createGain();
      vGain.gain.value = vocalVolume;
      mGain.gain.value = musicVolume;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);

      vocalSource.connect(vGain);
      vGain.connect(compressor);

      if (musicBuf) {
        const musicSource = ctx.createBufferSource();
        musicSource.buffer = musicBuf;
        musicSource.loop = true;
        musicSource.connect(mGain);
        mGain.connect(compressor);
        musicSource.start(0);
        musicNodeRef.current = musicSource;
      }

      compressor.connect(ctx.destination);
      vocalSource.start(0);
      vocalNodeRef.current = vocalSource;

      vocalSource.onended = () => { if (vocalNodeRef.current === vocalSource) stopPlayback(); };
      setIsPlaying(true);
      addLog("Đang phát: " + currentTrack.title);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Lỗi kỹ thuật khi phát âm thanh.");
      addLog("Lỗi Mastering: " + e.message);
    }
  };

  useEffect(() => {
    if (vocalGainRef.current) vocalGainRef.current.gain.value = vocalVolume;
    if (musicGainRef.current) musicGainRef.current.gain.value = musicVolume;
  }, [vocalVolume, musicVolume]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#030303] text-[#f0f0f0] overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Sidebar - Projects */}
      <aside className="hidden md:flex w-72 bg-[#0a0a0a] border-r border-white/5 flex-col p-6 shadow-2xl z-30">
        <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
                <Music className="text-white" size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tighter uppercase italic">Suno<span className="text-indigo-500">Master</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 block">Gần đây</span>
            {tracks.map(track => (
                <button
                    key={track.id}
                    onClick={() => setCurrentTrack(track)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${
                        currentTrack?.id === track.id ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/[0.02] border-transparent hover:bg-white/5'
                    }`}
                >
                    <img src={track.thumbnail} className="w-10 h-10 rounded-xl object-cover" alt="" />
                    <div className="text-left overflow-hidden">
                        <p className="text-[11px] font-bold truncate">{track.title}</p>
                        <p className="text-[9px] opacity-30 uppercase font-black">{track.genre}</p>
                    </div>
                </button>
            ))}
        </div>
        
        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/10 active:scale-95">
            <Plus size={16}/> New Track
        </button>
      </aside>

      {/* Main Rack Area */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] -z-10 rounded-full"></div>
        
        <header className="mb-10 flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">Production <span className="text-indigo-500">Rack</span></h2>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <p className="text-white/20 text-[9px] font-black uppercase tracking-widest italic">Digital Audio Workstation 2.5</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button className="p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"><Share2 size={16}/></button>
            </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          {/* Module: Input matrix */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex items-center gap-2 mb-6">
                    <Settings2 size={14} className="text-indigo-500"/>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">AI Composition Input</span>
                </div>
                
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Viết ý tưởng bài hát tại đây..."
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-sm h-40 focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/5 text-white/80 resize-none font-medium"
                />

                <div className="grid grid-cols-4 gap-2 mt-6">
                    {GENRES.map(g => (
                        <button key={g} onClick={() => setGenre(g)} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${genre === g ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/30'}`}>{g}</button>
                    ))}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={step !== GenerationStep.IDLE}
                    className="w-full mt-8 py-5 bg-white text-black hover:bg-indigo-600 hover:text-white disabled:opacity-20 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all"
                >
                    {step === GenerationStep.IDLE ? <><Sparkles size={16}/> <span>Generate</span></> : <div className="flex gap-2 items-center"><div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"></div> <span>Synthesizing...</span></div>}
                </button>
            </div>

            {/* Terminal Module */}
            <div className="bg-black/50 border border-white/10 rounded-[2rem] p-6 h-40 overflow-hidden flex flex-col shadow-inner">
                <div className="flex items-center gap-2 mb-3 opacity-20">
                    <Terminal size={12}/>
                    <span className="text-[9px] font-black uppercase tracking-widest">Process Log</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {logs.map((log, i) => <p key={i} className="text-[10px] text-indigo-400/70 font-mono italic animate-in slide-in-from-left">{log}</p>)}
                </div>
            </div>

            {errorMsg && <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-[10px] text-red-400 font-black uppercase tracking-widest flex items-center gap-3"><AlertCircle size={16}/> {errorMsg}</div>}
          </div>

          {/* Module: Master Output */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="bg-[#0f0f0f] border border-white/5 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
                    <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
                        <div className="relative">
                            <img src={currentTrack.thumbnail} className={`w-48 h-48 rounded-[2rem] object-cover relative z-10 border border-white/10 transition-all duration-700 ${isPlaying ? 'scale-105' : ''}`} alt="" />
                            <div className="absolute -bottom-2 -right-2 bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center z-20"><Disc className={isPlaying ? 'animate-spin-slow' : ''} size={24}/></div>
                        </div>
                        <div className="text-center md:text-left">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3 block">Mastered Output</span>
                            <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-4">{currentTrack.title}</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Genre: {currentTrack.genre} • High Dynamic Range</p>
                        </div>
                    </div>

                    <div className="mt-12 bg-black/40 border border-white/5 rounded-[2.5rem] p-8 space-y-10">
                        <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-4">
                              <div className="flex justify-between items-center px-2">
                                 <span className="text-[9px] font-black uppercase tracking-widest opacity-20 flex items-center gap-2"><Mic2 size={10}/> Vocal</span>
                                 <span className="text-[10px] font-bold text-indigo-500">{Math.round(vocalVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1.5" step="0.01" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-indigo-500 rounded-full" />
                           </div>
                           <div className="space-y-4">
                              <div className="flex justify-between items-center px-2">
                                 <span className="text-[9px] font-black uppercase tracking-widest opacity-20 flex items-center gap-2"><Music size={10}/> Instr</span>
                                 <span className="text-[10px] font-bold text-indigo-500">{Math.round(musicVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-indigo-500 rounded-full" />
                           </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8">
                           <button onClick={isPlaying ? stopPlayback : playMusic} className="w-20 h-20 bg-white text-black hover:bg-indigo-600 hover:text-white rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90">
                              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                           </button>
                           <div className="flex-1 w-full h-20 bg-black/60 rounded-[1.5rem] border border-white/5 p-4 overflow-hidden">
                                <Visualizer audioElement={null} isPlaying={isPlaying} />
                           </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-[2rem] p-8 h-80 overflow-y-auto custom-scrollbar">
                        <span className="text-[9px] font-black opacity-20 uppercase tracking-widest mb-6 block">Lyrics</span>
                        <p className="text-white/60 text-base leading-relaxed whitespace-pre-line italic font-serif">
                            {currentTrack.lyrics}
                        </p>
                    </div>
                    <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-[2rem] p-8 flex flex-col justify-between">
                        <div className="space-y-4">
                             <span className="text-[9px] font-black opacity-20 uppercase tracking-widest mb-4 block">Engine Data</span>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] uppercase opacity-30 font-bold mb-1">Rate</p>
                                    <p className="text-xs font-black">24 kHz</p>
                                </div>
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[8px] uppercase opacity-30 font-bold mb-1">Model</p>
                                    <p className="text-xs font-black text-indigo-400">Flash 2.5</p>
                                </div>
                             </div>
                        </div>
                        <button className="w-full py-4 bg-white/5 hover:bg-white text-white hover:text-black rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all mt-6 border border-white/10">
                            <Download size={14}/> Save Track
                        </button>
                    </div>
                </div>
              </div>
            ) : (
              <div className="h-[45rem] bg-black/20 border-2 border-dashed border-white/[0.03] rounded-[4rem] flex flex-col items-center justify-center text-white/5">
                <Waves size={80} className="mb-6 opacity-10" />
                <p className="text-xl font-black uppercase tracking-[0.4em]">Rack Empty</p>
                <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-30 italic">Sẵn sàng nhận tín hiệu mới</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        input[type='range']::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 1px solid #4f46e5;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
      `}} />
    </div>
  );
};

export default App;
