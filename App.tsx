
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, Download, Plus, AlertCircle, Volume2, Mic2, Disc, Waves, Layers, Terminal } from 'lucide-react';
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
  const [musicVolume, setMusicVolume] = useState(0.4);

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

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), `> ${msg}`]);

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
      addLog("Initializing neural network...");
      addLog(`Generating ${genre} lyrics for: "${prompt}"`);
      
      const songData = await generateSongStructure(prompt, genre);
      addLog(`Successfully composed: ${songData.title}`);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      addLog("Connecting to Native Audio Studio...");
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, genre);
      
      if (!audioBytes) {
          throw new Error("Không thể trích xuất âm thanh từ AI. Hãy thử chọn thể loại khác.");
      }

      addLog("Audio samples received. Encoding WAV...");
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
      addLog("Production complete. Track ready for playback.");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi không xác định. Vui lòng thử lại.');
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

      // Compressor để âm thanh hòa quyện
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      const vGain = ctx.createGain();
      const mGain = ctx.createGain();
      vGain.gain.value = vocalVolume;
      mGain.gain.value = musicVolume;

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

      vocalSource.onended = () => {
        if (vocalNodeRef.current === vocalSource) stopPlayback();
      };

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
    <div className="h-screen flex flex-col md:flex-row bg-[#050505] text-white overflow-hidden font-mono">
      {/* Sidebar Hardware View */}
      <aside className="hidden md:flex w-72 bg-[#0a0a0a] border-r border-white/10 flex-col p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 pb-6 border-b border-white/5">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Disc className="animate-spin-slow" size={20} />
          </div>
          <h1 className="text-lg font-black tracking-tighter">STUDIO <span className="text-orange-600">X</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          <p className="text-[9px] text-white/20 font-bold uppercase mb-4 tracking-widest">Library</p>
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => setCurrentTrack(track)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                currentTrack?.id === track.id ? 'bg-orange-600/10 border-orange-600/50' : 'bg-white/[0.02] border-transparent hover:bg-white/5'
              }`}
            >
              <img src={track.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
              <div className="text-left overflow-hidden">
                <p className="text-[11px] font-bold truncate">{track.title}</p>
                <p className="text-[9px] opacity-30">{track.genre}</p>
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-white/5">
            <div className="bg-black/50 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-white/20'}`}></div>
                <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{isPlaying ? 'Output Active' : 'System Idle'}</span>
            </div>
        </div>
      </aside>

      {/* Main Rack View */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end">
            <div>
                <h2 className="text-4xl font-black tracking-tighter uppercase mb-1">Production <span className="text-orange-600">Console</span></h2>
                <p className="text-white/20 text-xs font-bold uppercase tracking-[0.3em]">Hardware Emulation v3.0</p>
            </div>
            {currentTrack && (
                <button className="mt-4 md:mt-0 flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"><Download size={14}/> Export Stem</button>
            )}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Module 1: Input & AI Logs */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-4 right-6 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
               </div>
               
               <p className="text-[10px] font-black text-orange-600/60 uppercase tracking-widest mb-6">Input Matrix</p>
               
               <textarea
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder="Enter song concept here..."
                 className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-sm h-40 focus:border-orange-600/50 outline-none transition-all placeholder:text-white/5"
               />

               <div className="grid grid-cols-4 gap-2 mt-6">
                 {GENRES.map(g => (
                   <button key={g} onClick={() => setGenre(g)} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${genre === g ? 'bg-orange-600 border-orange-500 shadow-xl' : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/30'}`}>{g}</button>
                 ))}
               </div>

               <button
                 onClick={handleGenerate}
                 disabled={step !== GenerationStep.IDLE}
                 className="w-full mt-8 py-5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all"
               >
                 {step === GenerationStep.IDLE ? <><Sparkles size={18}/> Process Track</> : <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
               </button>
            </div>

            {/* Terminal View */}
            <div className="bg-black border border-white/10 rounded-3xl p-6 h-48 flex flex-col">
                <div className="flex items-center gap-2 mb-4 opacity-30">
                    <Terminal size={12}/>
                    <span className="text-[9px] font-black uppercase tracking-widest">AI Status Logs</span>
                </div>
                <div className="flex-1 text-[10px] space-y-2 text-green-500/80 font-mono">
                    {logs.length > 0 ? logs.map((log, i) => <p key={i} className="animate-in fade-in slide-in-from-left-2">{log}</p>) : <p className="opacity-20 italic">Waiting for input signal...</p>}
                </div>
            </div>
            
            {errorMsg && <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl text-[10px] text-red-400 font-bold flex items-center gap-3 uppercase tracking-widest animate-shake"><AlertCircle size={16}/> {errorMsg}</div>}
          </div>

          {/* Module 2: Mastering & Playback */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-6 animate-in zoom-in-95">
                <div className="bg-[#111] border border-white/10 rounded-[3rem] p-10 relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row gap-10 items-center">
                        <div className="relative group">
                            <div className={`absolute -inset-4 bg-orange-600/20 rounded-[3rem] blur-2xl transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
                            <img src={currentTrack.thumbnail} className={`w-52 h-52 rounded-[2.5rem] relative z-10 border border-white/10 object-cover ${isPlaying ? 'animate-pulse' : ''}`} alt="" />
                        </div>
                        <div className="text-center lg:text-left z-10">
                            <span className="text-[9px] font-black text-orange-500 border border-orange-500/30 px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-4 inline-block">Native Mastering</span>
                            <h3 className="text-5xl font-black uppercase tracking-tighter leading-none mb-4">{currentTrack.title}</h3>
                            <div className="flex gap-4 items-center justify-center lg:justify-start opacity-40">
                                <span className="text-[10px] font-bold flex items-center gap-1"><Mic2 size={12}/> {currentTrack.genre}</span>
                                <span className="text-[10px] font-bold flex items-center gap-1"><Layers size={12}/> Stereo Mix</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 bg-black/60 border border-white/5 rounded-[2.5rem] p-8 space-y-8">
                        <div className="grid grid-cols-2 gap-10">
                           <div className="space-y-4">
                              <div className="flex justify-between items-center px-2">
                                 <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Vocal</span>
                                 <span className="text-[9px] font-bold text-orange-500">{Math.round(vocalVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1.5" step="0.01" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 appearance-none accent-orange-500 rounded-full cursor-pointer" />
                           </div>
                           <div className="space-y-4">
                              <div className="flex justify-between items-center px-2">
                                 <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Instrumental</span>
                                 <span className="text-[9px] font-bold text-blue-500">{Math.round(musicVolume * 100)}%</span>
                              </div>
                              <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 appearance-none accent-blue-500 rounded-full cursor-pointer" />
                           </div>
                        </div>

                        <div className="flex items-center gap-8">
                           <button onClick={isPlaying ? stopPlayback : playMusic} className="w-24 h-24 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90">
                              {isPlaying ? <Pause size={40} fill="white" /> : <Play size={40} fill="white" className="ml-2" />}
                           </button>
                           <div className="flex-1 h-24 bg-black/40 rounded-3xl border border-white/5 p-4 relative overflow-hidden">
                              <Visualizer audioElement={null} isPlaying={isPlaying} />
                           </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-[3rem] p-10 h-80 overflow-y-auto custom-scrollbar">
                    <p className="text-[9px] font-black opacity-20 uppercase tracking-[0.4em] mb-8">Metadata / Lyrics</p>
                    <p className="text-white/70 text-lg font-medium leading-relaxed whitespace-pre-line italic">
                        {currentTrack.lyrics}
                    </p>
                </div>
              </div>
            ) : (
              <div className="h-[45rem] bg-[#0a0a0a] border-4 border-dashed border-white/[0.03] rounded-[4rem] flex flex-col items-center justify-center text-white/5">
                <Layers size={100} />
                <p className="text-xl font-black uppercase tracking-[0.4em] mt-8">Studio Mainframe Offline</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Initialize process to start</p>
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
          animation: spin-slow 8s linear infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out infinite;
          animation-iteration-count: 2;
        }
      `}} />
    </div>
  );
};

export default App;
