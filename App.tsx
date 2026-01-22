
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, Download, Plus, ChevronDown, ChevronUp, User, Info, AlertCircle, Volume2, Sliders, Mic2 } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep, VoiceSettings } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'Acoustic'];

// Cập nhật link nhạc nền ổn định hơn từ CDN uy tín
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

const ARTISTS = [
  { name: 'Mặc định', desc: 'Giọng AI tiêu chuẩn.' },
  { name: 'Sơn Tùng M-TP', desc: 'Trẻ trung, hiện đại.' },
  { name: 'Mỹ Tâm', desc: 'Nồng nàn, nội lực.' },
  { name: 'Hà Anh Tuấn', desc: 'Lịch lãm, tự sự.' },
  { name: 'Đen Vâu', desc: 'Rap chậm, vần điệu.' },
  { name: 'HIEUTHUHAI', desc: 'Rap hiện đại, lôi cuốn.' }
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [useCustomLyrics, setUseCustomLyrics] = useState(false);
  const [genre, setGenre] = useState('Pop');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Mixer Settings
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.6);

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    region: 'north',
    age: 'young',
    singerStyle: 'Mặc định',
    voiceName: 'Kore'
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track & { beatUrl?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [statusText, setStatusText] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const beatRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!useCustomLyrics && !prompt.trim()) return;
    setErrorMsg('');
    setIsPlaying(false);

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      setStatusText('Suno AI đang soạn lời và phối khí...');
      
      const songData = await generateSongStructure(prompt, genre, useCustomLyrics ? customLyrics : undefined);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      setStatusText(`Đang thu âm giọng ca ${voiceSettings.singerStyle}...`);
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, voiceSettings);
      
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
        thumbnail: `https://picsum.photos/seed/${Date.now()}/400/400`,
        settings: { ...voiceSettings },
        beatUrl: INSTRUMENTAL_BEATS[genre] || INSTRUMENTAL_BEATS['Pop']
      };

      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      setPrompt('');
      setStatusText('');
    } catch (error: any) {
      console.error("Lỗi:", error);
      setErrorMsg(error.message || 'Hệ thống đang bận, vui lòng thử lại sau giây lát.');
      setStep(GenerationStep.IDLE);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !beatRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      beatRef.current.pause();
      setIsPlaying(false);
    } else {
      // Đồng bộ thời gian của nhạc nền với giọng hát
      beatRef.current.currentTime = audioRef.current.currentTime;
      beatRef.current.volume = musicVolume;
      audioRef.current.volume = vocalVolume;
      beatRef.current.loop = true;
      
      const playPromise1 = beatRef.current.play();
      const playPromise2 = audioRef.current.play();

      Promise.all([playPromise1, playPromise2])
        .then(() => setIsPlaying(true))
        .catch(e => {
            console.error("Lỗi Playback:", e);
            setErrorMsg("Không thể phát nhạc. Vui lòng nhấn Play lại.");
        });
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vocalVolume;
  }, [vocalVolume]);

  useEffect(() => {
    if (beatRef.current) beatRef.current.volume = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    if (currentTrack) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.load();
        if (beatRef.current) beatRef.current.load();
    }
  }, [currentTrack]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-80 glass-morphism p-6 flex-col border-r border-white/5">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <Music className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none">MELODIFY</h1>
            <span className="text-[9px] opacity-40 uppercase tracking-[0.2em] font-bold">Creative Studio</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          <p className="text-[10px] text-white/30 font-black uppercase mb-4 px-2 tracking-widest">Lịch sử sáng tác</p>
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => setCurrentTrack(track)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                currentTrack?.id === track.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5 opacity-50 hover:opacity-100'
              }`}
            >
              <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover shadow-lg" alt="" />
              <div className="text-left overflow-hidden">
                <p className="font-bold truncate text-sm">{track.title}</p>
                <p className="text-[10px] text-white/40 font-medium">{track.genre} • {new Date(track.createdAt).toLocaleDateString()}</p>
              </div>
            </button>
          ))}
          {tracks.length === 0 && (
            <div className="py-20 text-center space-y-4 opacity-20">
                <div className="w-12 h-12 border border-dashed border-white rounded-full mx-auto flex items-center justify-center"><Plus size={20}/></div>
                <p className="text-xs italic">Chưa có bản nhạc nào</p>
            </div>
          )}
        </div>

        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-white text-black hover:bg-gray-100 rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-xl">
          <Plus size={18} /> Dự án mới
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div>
              <h2 className="text-4xl font-black mb-2 tracking-tighter">AI <span className="gradient-text">Music Studio</span></h2>
              <p className="text-white/40 text-sm font-medium">Sáng tạo âm nhạc chuyên nghiệp như Suno AI.</p>
           </div>
           {currentTrack && (
              <div className="flex gap-2">
                 <button className="px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/5"><Download size={16}/> Tải xuống</button>
              </div>
           )}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          {/* Input Section */}
          <div className="xl:col-span-5 space-y-6">
            <div className="glass-morphism rounded-[2.5rem] p-8 border-white/10 shadow-3xl relative">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-purple-400 uppercase tracking-[0.2em]">Sáng tác</span>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setUseCustomLyrics(false)} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${!useCustomLyrics ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>MÔ TẢ</button>
                  <button onClick={() => setUseCustomLyrics(true)} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${useCustomLyrics ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>LỜI NHẠC</button>
                </div>
              </div>

              <textarea
                value={useCustomLyrics ? customLyrics : prompt}
                onChange={(e) => useCustomLyrics ? setCustomLyrics(e.target.value) : setPrompt(e.target.value)}
                placeholder={useCustomLyrics ? "Dán lời bài hát của bạn..." : "Ví dụ: Một bài hát EDM sôi động về tuổi trẻ..."}
                className="w-full bg-white/5 border border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 rounded-3xl text-sm p-6 h-40 resize-none transition-all placeholder:text-white/10"
              />

              <div className="mt-8">
                <p className="text-[10px] font-black text-white/30 uppercase mb-5 tracking-widest">Chọn Beat nền (Thể loại)</p>
                <div className="grid grid-cols-4 gap-2">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => setGenre(g)} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${genre === g ? 'bg-purple-600 border-purple-500 shadow-xl shadow-purple-600/40' : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'}`}>{g}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full mt-6 py-4 flex items-center justify-center gap-2 text-white/40 text-[10px] font-black uppercase bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all tracking-widest">
                Cài đặt nghệ sĩ {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-6 bg-black/60 rounded-[2rem] space-y-6 border border-white/5 animate-in slide-in-from-top-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2"><User size={12}/> Giọng hát phỏng theo</label>
                    <div className="grid grid-cols-2 gap-3">
                        {ARTISTS.map(a => (
                            <button 
                                key={a.name}
                                onClick={() => setVoiceSettings({...voiceSettings, singerStyle: a.name})}
                                className={`text-[10px] p-3 rounded-xl border text-left transition-all ${voiceSettings.singerStyle === a.name ? 'border-purple-500 bg-purple-500/20' : 'border-white/5 bg-white/5'}`}
                            >
                                <p className="font-black mb-1">{a.name}</p>
                                <p className="opacity-40 text-[9px] leading-tight">{a.desc}</p>
                            </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={step !== GenerationStep.IDLE}
                className="mt-8 w-full py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl font-black text-xs tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl shadow-purple-600/30"
              >
                {step === GenerationStep.IDLE ? <><Sparkles size={20} /> <span>Tạo bài hát</span></> : <><div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> <span>Đang xử lý {step === GenerationStep.WRITING_LYRICS ? 'Lời nhạc' : 'Giọng hát'}...</span></>}
              </button>
            </div>
            
            {statusText && <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[10px] text-indigo-300 font-black animate-pulse text-center tracking-widest uppercase">{statusText}</div>}
            {errorMsg && <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-3 font-bold"><AlertCircle size={18}/> {errorMsg}</div>}
          </div>

          {/* Player Section */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-8 animate-in zoom-in-95 duration-700">
                <div className="glass-morphism rounded-[3.5rem] p-12 border-white/10 relative overflow-hidden shadow-3xl bg-gradient-to-br from-white/[0.03] to-transparent">
                  <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="relative group">
                        <img src={currentTrack.thumbnail} className="w-56 h-56 rounded-[2.5rem] shadow-3xl object-cover ring-8 ring-white/[0.02] group-hover:scale-105 transition-transform duration-700" alt="" />
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
                             <Music className="text-white" size={28}/>
                        </div>
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <span className="bg-purple-600/20 text-purple-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-5 inline-block border border-purple-500/20">Studio Master</span>
                      <h3 className="text-5xl font-black mb-4 leading-none tracking-tighter">{currentTrack.title}</h3>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 opacity-60">
                        <p className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest"><User size={16} className="text-purple-500"/> {currentTrack.settings?.singerStyle}</p>
                        <p className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest"><Music size={16} className="text-blue-500"/> Beat {currentTrack.genre}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mixer UI */}
                  <div className="mt-12 p-8 bg-black/40 rounded-[2.5rem] border border-white/5 space-y-8">
                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40 tracking-widest">
                              <span className="flex items-center gap-2"><Mic2 size={12}/> Giọng hát</span>
                              <span>{Math.round(vocalVolume * 100)}%</span>
                           </div>
                           <input type="range" min="0" max="1.5" step="0.1" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full accent-purple-500" />
                        </div>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40 tracking-widest">
                              <span className="flex items-center gap-2"><Volume2 size={12}/> Nhạc nền</span>
                              <span>{Math.round(musicVolume * 100)}%</span>
                           </div>
                           <input type="range" min="0" max="1" step="0.1" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full accent-blue-500" />
                        </div>
                     </div>

                     <div className="flex items-center gap-8">
                        <button onClick={togglePlay} className="w-24 h-24 bg-white text-black rounded-full flex items-center justify-center shadow-3xl hover:scale-110 active:scale-95 transition-all shrink-0">
                          {isPlaying ? <Pause size={40} fill="black" /> : <Play size={40} fill="black" className="ml-2" />}
                        </button>
                        <div className="flex-1 h-24 bg-black/60 rounded-[2rem] overflow-hidden border border-white/5 p-4">
                           <Visualizer audioElement={audioRef.current} isPlaying={isPlaying} />
                        </div>
                     </div>
                  </div>
                  
                  {/* Hidden Audio Elements */}
                  <audio ref={audioRef} src={currentTrack.audioUrl} onEnded={() => { setIsPlaying(false); if(beatRef.current) beatRef.current.pause(); }} className="hidden" />
                  <audio ref={beatRef} src={currentTrack.beatUrl} className="hidden" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-morphism p-10 rounded-[3rem] border-white/5 h-[30rem] overflow-y-auto custom-scrollbar">
                    <h4 className="text-xs font-black mb-8 text-white/20 uppercase tracking-[0.3em] flex items-center gap-3"><Sliders size={18} className="text-purple-500"/> Lời bài hát</h4>
                    <p className="text-white/80 text-lg leading-relaxed whitespace-pre-line font-medium">{currentTrack.lyrics}</p>
                  </div>
                  <div className="glass-morphism p-10 rounded-[3rem] border-white/5 h-[30rem] flex flex-col">
                    <h4 className="text-xs font-black mb-8 text-white/20 uppercase tracking-[0.3em] flex items-center gap-3"><Info size={18} className="text-blue-500"/> Chi tiết hòa âm</h4>
                    <div className="space-y-6 flex-1">
                      <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-xs text-white/30 font-bold uppercase tracking-widest">Trạng thái</span><span className="text-sm font-black text-green-400 uppercase tracking-widest">Đã Mixing</span></div>
                      <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-xs text-white/30 font-bold uppercase tracking-widest">Đồng bộ</span><span className="text-sm font-black">100% Sync</span></div>
                      <div className="flex justify-between items-center py-4 border-b border-white/5"><span className="text-xs text-white/30 font-bold uppercase tracking-widest">Kênh âm thanh</span><span className="text-sm font-black">2-Channel Stereo</span></div>
                      <div className="flex justify-between items-center py-4"><span className="text-xs text-white/30 font-bold uppercase tracking-widest">Mẫu (Sample)</span><span className="text-sm font-black">24bit / 48kHz</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[40rem] flex flex-col items-center justify-center text-white/5 border-4 border-dashed border-white/[0.02] rounded-[4rem] animate-pulse">
                <div className="w-40 h-40 bg-white/[0.02] rounded-full flex items-center justify-center mb-8 border border-white/5">
                    <Music size={80} className="opacity-10" />
                </div>
                <p className="text-2xl font-black tracking-[0.3em] opacity-10 uppercase">Hệ thống đang sẵn sàng</p>
                <p className="text-sm mt-4 opacity-5 font-bold tracking-widest">NHẬP Ý TƯỞNG ĐỂ BẮT ĐẦU SẢN XUẤT</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
