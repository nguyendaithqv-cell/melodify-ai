
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, Download, Plus, ChevronDown, ChevronUp, User, Info, AlertCircle, Volume2, Mic2, Disc, Waves, Layers } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep, VoiceSettings } from './types';
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
  const [customLyrics, setCustomLyrics] = useState('');
  const [useCustomLyrics, setUseCustomLyrics] = useState(false);
  const [genre, setGenre] = useState('Pop');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Mixer & Audio
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [reverbLevel, setReverbLevel] = useState(0.3);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track & { beatUrl?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [statusText, setStatusText] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const vocalNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const handleGenerate = async () => {
    if (!useCustomLyrics && !prompt.trim()) return;
    setErrorMsg('');
    setIsPlaying(false);
    stopPlayback();

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      setStatusText('Suno AI đang soạn lời nhạc chuyên nghiệp...');
      
      const songData = await generateSongStructure(prompt, genre, useCustomLyrics ? customLyrics : undefined);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      setStatusText(`Đang thu âm giọng ca Native Audio (${genre})...`);
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, { region: 'north', age: 'young', voiceName: 'Kore' }, genre);
      
      if (!audioBytes) throw new Error("Lỗi kết nối Studio. Vui lòng thử lại!");

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
        thumbnail: `https://picsum.photos/seed/${Date.now()}/600/600`,
        beatUrl: INSTRUMENTAL_BEATS[genre] || INSTRUMENTAL_BEATS['Pop']
      };

      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      setStatusText('');
    } catch (error: any) {
      console.error("Lỗi:", error);
      setErrorMsg(error.message || 'Hệ thống đang bận. Vui lòng thử lại.');
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

      // Hiệu ứng vang (Reverb giả lập bằng Gain và Delay nhẹ)
      const reverb = ctx.createGain();
      reverb.gain.value = reverbLevel;

      vocalSource.connect(vGain);
      vGain.connect(ctx.destination);
      
      musicSource.connect(mGain);
      mGain.connect(ctx.destination);

      vocalSource.start(0);
      musicSource.start(0);

      vocalNodeRef.current = vocalSource;
      musicNodeRef.current = musicSource;
      vocalGainRef.current = vGain;
      musicGainRef.current = mGain;

      vocalSource.onended = () => {
        if (vocalNodeRef.current === vocalSource) stopPlayback();
      };

      setIsPlaying(true);
    } catch (e) {
      console.error("Playback error:", e);
      setErrorMsg("Lỗi phát nhạc. Hãy thử tạo lại.");
    }
  };

  useEffect(() => {
    if (vocalGainRef.current) vocalGainRef.current.gain.value = vocalVolume;
    if (musicGainRef.current) musicGainRef.current.gain.value = musicVolume;
  }, [vocalVolume, musicVolume]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#020202] text-white overflow-hidden font-sans">
      {/* DAW-style Sidebar */}
      <aside className="hidden md:flex w-80 bg-[#080808] border-r border-white/5 flex-col p-6">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-gradient-to-tr from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-500/10">
            <Disc className="w-7 h-7 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">SUNO <span className="text-orange-500">PRO</span></h1>
            <p className="text-[9px] opacity-40 uppercase font-bold tracking-[0.2em]">Music Engine v2.5</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          <p className="text-[10px] text-white/20 font-black uppercase mb-4 tracking-widest px-2">Dự án gần đây</p>
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => setCurrentTrack(track)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 group ${
                currentTrack?.id === track.id ? 'bg-orange-500/10 border border-orange-500/20' : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="relative">
                <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover" alt="" />
                {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-orange-500/40 rounded-xl flex items-center justify-center"><Waves className="animate-pulse" size={16}/></div>}
              </div>
              <div className="text-left overflow-hidden">
                <p className={`font-bold truncate text-sm transition-colors ${currentTrack?.id === track.id ? 'text-orange-500' : 'text-white/80'}`}>{track.title}</p>
                <p className="text-[10px] text-white/30 uppercase font-black">{track.genre}</p>
              </div>
            </button>
          ))}
          {tracks.length === 0 && <div className="py-20 text-center opacity-10"><Music size={40} className="mx-auto mb-4"/> <p className="text-xs">Chưa có bản nhạc</p></div>}
        </div>

        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-white transition-all">
          <Plus size={18}/> New Project
        </button>
      </aside>

      {/* Main Studio Workspace */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none"></div>

        <header className="mb-12 relative flex justify-between items-center">
          <div>
            <h2 className="text-5xl font-black tracking-tighter mb-2">Studio <span className="text-orange-500">Mastering</span></h2>
            <p className="text-white/30 font-medium">Native Audio AI - Đỉnh cao công nghệ tạo nhạc.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 relative">
          {/* Creator Console */}
          <div className="xl:col-span-5 space-y-8">
            <div className="bg-[#111] rounded-[3rem] p-10 border border-white/5 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Composer Console</span>
              </div>

              <div className="space-y-6">
                <textarea
                  value={useCustomLyrics ? customLyrics : prompt}
                  onChange={(e) => useCustomLyrics ? setCustomLyrics(e.target.value) : setPrompt(e.target.value)}
                  placeholder="Mô tả bài hát bạn muốn tạo (ví dụ: Ballad buồn về những chiều mưa Hà Nội...)"
                  className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-8 text-sm h-48 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all resize-none placeholder:text-white/5 font-medium"
                />

                <div className="grid grid-cols-4 gap-2">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => setGenre(g)} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${genre === g ? 'bg-orange-500 border-orange-500 shadow-xl shadow-orange-500/20' : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/40'}`}>{g}</button>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={step !== GenerationStep.IDLE}
                  className="w-full py-6 bg-orange-500 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/30 hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
                >
                  {step === GenerationStep.IDLE ? <><Sparkles size={20}/> <span>Generate Track</span></> : <><div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"/> <span>Processing...</span></>}
                </button>
              </div>
            </div>

            {statusText && <div className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-3xl text-[10px] font-black uppercase text-center text-orange-400 tracking-widest animate-pulse">{statusText}</div>}
            {errorMsg && <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-xs font-bold text-red-400 flex items-center gap-3"><AlertCircle size={20}/> {errorMsg}</div>}
          </div>

          {/* Mixing Board */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="bg-[#111] rounded-[4rem] p-12 border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                  
                  <div className="flex flex-col lg:flex-row items-center gap-12 mb-16">
                    <div className="relative">
                      <div className={`absolute inset-0 bg-orange-500 blur-2xl opacity-20 transition-opacity duration-1000 ${isPlaying ? 'opacity-40' : 'opacity-10'}`}></div>
                      <img src={currentTrack.thumbnail} className={`w-64 h-64 rounded-[3rem] object-cover relative z-10 shadow-3xl transition-transform duration-1000 ${isPlaying ? 'scale-105 rotate-2' : ''}`} alt="" />
                    </div>
                    <div className="text-center lg:text-left flex-1 z-10">
                      <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
                         <span className="px-4 py-1.5 bg-orange-500 text-black text-[10px] font-black rounded-full uppercase tracking-widest">Mastered</span>
                         <span className="px-4 py-1.5 bg-white/5 text-white/40 text-[10px] font-black rounded-full uppercase tracking-widest border border-white/5">24-Bit Audio</span>
                      </div>
                      <h3 className="text-6xl font-black mb-4 tracking-tighter leading-none">{currentTrack.title}</h3>
                      <p className="text-white/40 font-black uppercase tracking-widest text-xs flex items-center justify-center lg:justify-start gap-3">
                        <User size={16} className="text-orange-500"/> Native Vocal • {currentTrack.genre}
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/60 rounded-[3rem] p-10 border border-white/5 space-y-10">
                    <div className="grid grid-cols-2 gap-12">
                       <div className="space-y-4">
                          <div className="flex justify-between items-center px-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2"><Mic2 size={12}/> Vocal Gain</span>
                             <span className="text-[10px] font-bold text-orange-500">{Math.round(vocalVolume * 100)}%</span>
                          </div>
                          <input type="range" min="0" max="1.5" step="0.01" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-orange-500 cursor-pointer" />
                       </div>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center px-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2"><Layers size={12}/> Beat Gain</span>
                             <span className="text-[10px] font-bold text-blue-500">{Math.round(musicVolume * 100)}%</span>
                          </div>
                          <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-blue-500 cursor-pointer" />
                       </div>
                    </div>

                    <div className="flex items-center gap-10">
                       <button onClick={isPlaying ? stopPlayback : playMusic} className="w-28 h-28 bg-orange-500 text-black rounded-full flex items-center justify-center shadow-3xl hover:scale-110 active:scale-95 transition-all shrink-0">
                          {isPlaying ? <Pause size={48} fill="black" /> : <Play size={48} fill="black" className="ml-2" />}
                       </button>
                       <div className="flex-1 h-28 bg-black/40 rounded-[2.5rem] border border-white/5 overflow-hidden p-4">
                          {isPlaying ? <Visualizer audioElement={null} isPlaying={isPlaying} /> : <div className="h-full flex items-center justify-center opacity-10"><Waves size={40}/></div>}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-[#111] p-10 rounded-[3rem] border border-white/5 h-[35rem] overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-black mb-8 text-white/20 uppercase tracking-[0.4em]">Lyrics Metadata</h4>
                    <p className="text-white/80 text-xl leading-[1.8] font-medium whitespace-pre-line">{currentTrack.lyrics}</p>
                  </div>
                  <div className="bg-[#111] p-10 rounded-[3rem] border border-white/5 h-[35rem] flex flex-col">
                    <h4 className="text-[10px] font-black mb-8 text-white/20 uppercase tracking-[0.4em]">Studio Specs</h4>
                    <div className="space-y-8 flex-1">
                      <div className="flex justify-between items-center py-5 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Processing</span><span className="text-xs font-black text-orange-500 uppercase tracking-widest">Gemini 2.5 Native</span></div>
                      <div className="flex justify-between items-center py-5 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Audio Quality</span><span className="text-xs font-black">48kHz / Stereo</span></div>
                      <div className="flex justify-between items-center py-5 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Mixing Status</span><span className="text-xs font-black text-green-500 uppercase">Balanced</span></div>
                      <div className="flex justify-between items-center py-5"><span className="text-[11px] text-white/30 font-bold uppercase">Latency</span><span className="text-xs font-black">Ultra-Low</span></div>
                      
                      <div className="mt-10 p-6 bg-black rounded-3xl border border-white/5">
                        <p className="text-[9px] font-black text-white/20 uppercase mb-4 text-center">Export Track</p>
                        <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all border border-white/5"><Download size={16}/> Download MP3</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[45rem] bg-[#080808] border-4 border-dashed border-white/[0.02] rounded-[5rem] flex flex-col items-center justify-center animate-pulse">
                <Disc size={120} className="text-white/5 mb-10" />
                <p className="text-3xl font-black text-white/10 uppercase tracking-[0.4em]">Studio Offline</p>
                <p className="text-xs mt-4 text-white/5 font-bold uppercase tracking-widest">Nhập ý tưởng để kích hoạt bộ xử lý âm thanh</p>
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
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 3px solid currentColor;
        }
      `}} />
    </div>
  );
};

export default App;
