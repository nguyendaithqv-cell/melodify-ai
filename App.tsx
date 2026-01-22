
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, Download, Plus, AlertCircle, Volume2, Mic2, Disc, Waves, Layers, Terminal, ListMusic, Settings2 } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'Acoustic'];

const INSTRUMENTAL_BEATS: Record<string, string> = {
  'Pop': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'Ballad': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'Rock': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'EDM': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'Bolero': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'Lofi': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'Hip-hop': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'Acoustic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3'
};

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.5);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track & { beatUrl?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [logs, setLogs] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const vocalNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-5), `[${new Date().toLocaleTimeString()}] ${msg}`]);

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
      addLog("Khởi tạo hệ thống Suno AI Engine...");
      addLog(`Đang soạn thảo lời nhạc: "${prompt}"`);
      
      const songData = await generateSongStructure(prompt, genre);
      addLog(`Đã hoàn thành lời bài hát: ${songData.title}`);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      addLog("Kết nối máy chủ âm thanh Gemini 2.5...");
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, genre);
      
      if (!audioBytes) {
          throw new Error("Không thể tạo vocal. Hãy thử chủ đề hoặc thể loại khác.");
      }

      addLog("Đã nhận dữ liệu Vocal. Đang mã hóa 24kHz WAV...");
      const pcmData = new Int16Array(audioBytes.buffer);
      const wavBlob = pcmToWav(pcmData, 24000);
      const audioUrl = URL.createObjectURL(wavBlob);

      const newTrack: Track & { beatUrl?: string } = {
        id: Date.now().toString(),
        title: songData.title,
        genre: songData.genre,
        lyrics: songData.lyrics,
        audioUrl: audioUrl,
        createdAt: Date.now(),
        thumbnail: `https://picsum.photos/seed/${Date.now()}/400/400`,
        beatUrl: INSTRUMENTAL_BEATS[genre] || INSTRUMENTAL_BEATS['Pop']
      };

      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      addLog("Sản xuất hoàn tất. Track đã sẵn sàng!");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Hệ thống đang bận.');
      setStep(GenerationStep.IDLE);
    }
  };

  const stopPlayback = () => {
    if (vocalNodeRef.current) { vocalNodeRef.current.stop(); vocalNodeRef.current = null; }
    if (musicNodeRef.current) { musicNodeRef.current.stop(); musicNodeRef.current = null; }
    setIsPlaying(false);
  };

  const playMusic = async () => {
    if (!currentTrack || !currentTrack.audioUrl || !currentTrack.beatUrl) return;
    initAudio();
    const ctx = audioContextRef.current!;
    if (ctx.state === 'suspended') await ctx.resume();

    stopPlayback();

    try {
      const [vocalBuf, musicBuf] = await Promise.all([
        fetch(currentTrack.audioUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
        fetch(currentTrack.beatUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
      ]);

      const vocalSource = ctx.createBufferSource();
      const musicSource = ctx.createBufferSource();
      vocalSource.buffer = vocalBuf;
      musicSource.buffer = musicBuf;
      musicSource.loop = true;

      const vGain = ctx.createGain();
      const mGain = ctx.createGain();
      vGain.gain.value = vocalVolume;
      mGain.gain.value = musicVolume;

      const compressor = ctx.createDynamicsCompressor();
      
      vocalSource.connect(vGain);
      vGain.connect(compressor);
      musicSource.connect(mGain);
      mGain.connect(compressor);
      compressor.connect(ctx.destination);

      vocalSource.start(0);
      musicSource.start(0);

      vocalNodeRef.current = vocalSource;
      musicNodeRef.current = musicSource;
      vocalGainRef.current = vGain;
      musicGainRef.current = mGain;

      vocalSource.onended = () => { if (vocalNodeRef.current === vocalSource) stopPlayback(); };
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      setErrorMsg("Lỗi khi tải dữ liệu âm thanh.");
    }
  };

  useEffect(() => {
    if (vocalGainRef.current) vocalGainRef.current.gain.value = vocalVolume;
    if (musicGainRef.current) musicGainRef.current.gain.value = musicVolume;
  }, [vocalVolume, musicVolume]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#020202] text-[#e0e0e0] overflow-hidden font-sans">
      {/* Sidebar - Library */}
      <aside className="hidden md:flex w-80 bg-[#080808] border-r border-white/5 flex-col p-6 shadow-2xl relative z-20">
        <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Music className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">Melodify<span className="text-indigo-500">AI</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Bộ sưu tập</span>
                <ListMusic size={14} className="text-white/20"/>
            </div>
            {tracks.map(track => (
                <button
                    key={track.id}
                    onClick={() => setCurrentTrack(track)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border group ${
                        currentTrack?.id === track.id ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-white/[0.02] border-transparent hover:bg-white/5'
                    }`}
                >
                    <div className="relative overflow-hidden rounded-lg">
                        <img src={track.thumbnail} className="w-12 h-12 object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center"><Waves size={16} className="animate-pulse text-white"/></div>}
                    </div>
                    <div className="text-left overflow-hidden">
                        <p className="text-xs font-bold truncate group-hover:text-indigo-400 transition-colors">{track.title}</p>
                        <p className="text-[9px] opacity-40 uppercase font-black">{track.genre}</p>
                    </div>
                </button>
            ))}
        </div>
        
        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 hover:text-white transition-all shadow-xl shadow-white/5">
            <Plus size={18}/> New Project
        </button>
      </aside>

      {/* Main Studio Area */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar relative bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] -z-10 rounded-full"></div>
        
        <header className="mb-12 flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">AI Studio <span className="text-indigo-500">Mastering</span></h2>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Neural Engine Online • Native Audio v2.5</p>
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          {/* Module 1: Input Matrix */}
          <div className="xl:col-span-5 space-y-8">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-3xl">
                <div className="flex items-center gap-3 mb-8">
                    <Settings2 size={16} className="text-indigo-500"/>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Input Configuration</span>
                </div>
                
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Mô tả ca khúc của bạn (vd: Bài hát buồn về mưa Sài Gòn)..."
                    className="w-full bg-black/40 border border-white/5 rounded-3xl p-8 text-sm h-48 focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/10 text-white/80 resize-none font-medium"
                />

                <div className="grid grid-cols-4 gap-2 mt-8">
                    {GENRES.map(g => (
                        <button key={g} onClick={() => setGenre(g)} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${genre === g ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/30' : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/30'}`}>{g}</button>
                    ))}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={step !== GenerationStep.IDLE}
                    className="w-full mt-10 py-6 bg-white text-black hover:bg-indigo-500 hover:text-white disabled:opacity-20 rounded-3xl font-black text-xs uppercase tracking-[0.4em] flex items-center justify-center gap-4 transition-all duration-500 transform hover:scale-[1.02] active:scale-95"
                >
                    {step === GenerationStep.IDLE ? <><Sparkles size={18}/> <span>Produce Track</span></> : <div className="flex gap-2 items-center"><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div> <span>Processing...</span></div>}
                </button>
            </div>

            {/* Console Output */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] p-8 h-48 overflow-hidden flex flex-col shadow-inner">
                <div className="flex items-center gap-3 mb-4 opacity-30">
                    <Terminal size={14}/>
                    <span className="text-[9px] font-black uppercase tracking-widest">Neural System Logs</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                    {logs.map((log, i) => <p key={i} className="text-[10px] text-indigo-400 font-mono animate-in slide-in-from-left duration-300">{log}</p>)}
                    {logs.length === 0 && <p className="text-[10px] text-white/5 italic">Waiting for process initiation...</p>}
                </div>
            </div>

            {errorMsg && <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4"><AlertCircle size={20}/> {errorMsg}</div>}
          </div>

          {/* Module 2: Mastering Console */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-8 animate-in zoom-in-95 duration-700">
                <div className="bg-[#0f0f0f] border border-white/5 rounded-[3.5rem] p-12 relative overflow-hidden shadow-2xl group">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full"></div>
                    
                    <div className="flex flex-col lg:flex-row gap-12 items-center relative z-10">
                        <div className="relative">
                            <div className={`absolute -inset-6 bg-indigo-600/20 rounded-full blur-3xl transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
                            <img src={currentTrack.thumbnail} className={`w-64 h-64 rounded-[3rem] object-cover relative z-10 border border-white/10 shadow-3xl transition-all duration-1000 ${isPlaying ? 'scale-105 rotate-3' : ''}`} alt="" />
                            <div className="absolute -bottom-4 -right-4 bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center z-20 shadow-xl"><Disc className={isPlaying ? 'animate-spin-slow' : ''} size={30}/></div>
                        </div>
                        <div className="text-center lg:text-left flex-1">
                            <span className="text-[9px] font-black bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 px-4 py-1.5 rounded-full uppercase tracking-[0.3em] mb-6 inline-block">Master Output</span>
                            <h3 className="text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-6 text-white">{currentTrack.title}</h3>
                            <div className="flex gap-6 items-center justify-center lg:justify-start">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2 border border-white/5 px-4 py-2 rounded-xl"><Mic2 size={12} className="text-indigo-500"/> {currentTrack.genre}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2 border border-white/5 px-4 py-2 rounded-xl"><Layers size={12} className="text-purple-500"/> High Fidelity</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-16 bg-black/40 border border-white/5 rounded-[3rem] p-10 space-y-12 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                           <div className="space-y-5">
                              <div className="flex justify-between items-center px-4">
                                 <span className="text-[10px] font-black uppercase tracking-widest opacity-30 flex items-center gap-2"><Volume2 size={12}/> Vocal Gain</span>
                                 <span className="text-[10px] font-black text-indigo-500">{Math.round(vocalVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1.5" step="0.01" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-indigo-500 rounded-full cursor-pointer" />
                           </div>
                           <div className="space-y-5">
                              <div className="flex justify-between items-center px-4">
                                 <span className="text-[10px] font-black uppercase tracking-widest opacity-30 flex items-center gap-2"><Music size={12}/> Instrumental</span>
                                 <span className="text-[10px] font-black text-purple-500">{Math.round(musicVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-purple-500 rounded-full cursor-pointer" />
                           </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-10">
                           <button onClick={isPlaying ? stopPlayback : playMusic} className="w-28 h-28 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 transform active:scale-90 group">
                              {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
                           </button>
                           <div className="flex-1 w-full h-28 bg-black/60 rounded-[2.5rem] border border-white/5 p-6 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Visualizer audioElement={null} isPlaying={isPlaying} />
                           </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-[3rem] p-10 h-96 overflow-y-auto custom-scrollbar group">
                        <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#0f0f0f] py-2">
                             <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.4em]">Lyrics Metadata</span>
                             <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:text-indigo-500 transition-colors"><Terminal size={12}/></div>
                        </div>
                        <p className="text-white/70 text-lg font-medium leading-[1.8] whitespace-pre-line italic font-serif">
                            {currentTrack.lyrics}
                        </p>
                    </div>
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between">
                        <div className="space-y-8">
                            <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.4em]">Project Specs</span>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-[11px] text-white/20 font-bold uppercase">Sample Rate</span><span className="text-xs font-black text-indigo-500">24kHz / 16Bit</span></div>
                                <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-[11px] text-white/20 font-bold uppercase">Engine</span><span className="text-xs font-black">Flash 2.5 TTS</span></div>
                                <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-[11px] text-white/20 font-bold uppercase">Mixing</span><span className="text-xs font-black text-green-500 uppercase">Synchronized</span></div>
                            </div>
                        </div>
                        <button className="w-full py-5 bg-white/5 hover:bg-white text-white hover:text-black rounded-[2rem] flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all border border-white/10 mt-10">
                            <Download size={18}/> Download MP3
                        </button>
                    </div>
                </div>
              </div>
            ) : (
              <div className="h-[50rem] bg-black/40 border-2 border-dashed border-white/[0.03] rounded-[4rem] flex flex-col items-center justify-center text-white/5 animate-pulse">
                <Music size={120} className="mb-10 opacity-20" />
                <p className="text-2xl font-black uppercase tracking-[0.5em]">Studio Mainframe Offline</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-50">Nhập mô tả ý tưởng để kích hoạt hệ thống tạo nhạc</p>
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
          animation: spin-slow 12s linear infinite;
        }
        input[type='range']::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid currentColor;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
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
