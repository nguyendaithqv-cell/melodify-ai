
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, History, Send, Download, Plus, Mic, RotateCcw, ChevronDown, ChevronUp, User, Globe, Baby, Info, AlertCircle, Volume2 } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep, VoiceSettings } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'Acoustic'];

// Danh sách Beat thực tế để hòa âm
const INSTRUMENTAL_BEATS: Record<string, string> = {
  'Pop': 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  'Ballad': 'https://assets.mixkit.co/music/preview/mixkit-delicate-acoustic-guitar-9.mp3',
  'Rock': 'https://assets.mixkit.co/music/preview/mixkit-heavy-rock-guitar-24.mp3',
  'EDM': 'https://assets.mixkit.co/music/preview/mixkit-complex-234.mp3',
  'Bolero': 'https://assets.mixkit.co/music/preview/mixkit-latin-jazz-34.mp3',
  'Lofi': 'https://assets.mixkit.co/music/preview/mixkit-lo-fi-night-612.mp3',
  'Hip-hop': 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
  'Acoustic': 'https://assets.mixkit.co/music/preview/mixkit-sun-and-clouds-248.mp3'
};

const ARTISTS = [
  { name: 'Mặc định', desc: 'Sử dụng giọng AI tự nhiên.' },
  { name: 'Sơn Tùng M-TP', desc: 'Trẻ trung, hiện đại.' },
  { name: 'Mỹ Tâm', desc: 'Nồng nàn, nội lực.' },
  { name: 'Hà Anh Tuấn', desc: 'Lịch lãm, sang trọng.' },
  { name: 'Đen Vâu', desc: 'Mộc mạc, đậm chất đời.' },
  { name: 'HIEUTHUHAI', desc: 'Rap Gen Z lôi cuốn.' }
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [useCustomLyrics, setUseCustomLyrics] = useState(false);
  const [genre, setGenre] = useState('Pop');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
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

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      setStatusText('AI đang soạn lời và giai điệu...');
      
      const songData = await generateSongStructure(prompt, genre, useCustomLyrics ? customLyrics : undefined);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      setStatusText(`Đang huấn luyện giọng hát ${voiceSettings.singerStyle}...`);
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, voiceSettings);
      
      if (!audioBytes) throw new Error("Không thể tạo giọng hát. Thử lại sau!");

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
        thumbnail: `https://picsum.photos/seed/${songData.title}/400/400`,
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
      setErrorMsg(error.message || 'Hệ thống đang quá tải, vui lòng thử lại.');
      setStep(GenerationStep.IDLE);
      setStatusText('');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !beatRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      beatRef.current.pause();
    } else {
      // Nhạc nền nhỏ hơn một chút để nghe rõ giọng hát
      beatRef.current.volume = 0.4;
      beatRef.current.loop = true;
      
      beatRef.current.play().catch(e => console.error("Lỗi phát nhạc nền:", e));
      audioRef.current.play().catch(e => console.error("Lỗi phát giọng hát:", e));
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (currentTrack) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.load();
        if (beatRef.current) beatRef.current.load();
    }
  }, [currentTrack]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#0a0a0a] text-white overflow-hidden">
      {/* Sidebar - Lịch sử sáng tác */}
      <aside className="hidden md:flex w-72 glass-morphism p-5 flex-col border-r border-white/5">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Music className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">MELODIFY <span className="text-[8px] block opacity-50 uppercase tracking-widest">AI Studio</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
          <p className="text-[10px] text-white/30 font-bold uppercase mb-4 px-2">Bộ sưu tập của bạn</p>
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => setCurrentTrack(track)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                currentTrack?.id === track.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={track.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
              <div className="text-left overflow-hidden">
                <p className="font-semibold truncate text-xs">{track.title}</p>
                <p className="text-[10px] text-white/40">{track.genre}</p>
              </div>
            </button>
          ))}
          {tracks.length === 0 && <p className="text-white/20 text-center py-20 text-xs italic">Chưa có bản nhạc nào được tạo</p>}
        </div>

        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 bg-white text-black hover:bg-gray-200 rounded-2xl transition-all font-bold text-xs uppercase">
          <Plus size={16} /> Dự án mới
        </button>
      </aside>

      {/* Giao diện chính */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar">
        <header className="mb-8 flex justify-between items-center">
           <div>
              <h2 className="text-3xl font-black mb-1">Studio <span className="gradient-text">Âm Nhạc AI</span></h2>
              <p className="text-white/40 text-xs">Biến ý tưởng thành bài hát chuyên nghiệp chỉ trong vài giây.</p>
           </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Form nhập liệu */}
          <div className="xl:col-span-5 space-y-5">
            <div className="glass-morphism rounded-[2.5rem] p-7 border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles size={80} className="text-white" />
              </div>
              
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Sáng tác ngay</span>
                <div className="flex bg-black/50 p-1 rounded-xl">
                  <button onClick={() => setUseCustomLyrics(false)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${!useCustomLyrics ? 'bg-white/10 text-white' : 'text-white/30'}`}>AI VIẾT</button>
                  <button onClick={() => setUseCustomLyrics(true)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${useCustomLyrics ? 'bg-white/10 text-white' : 'text-white/30'}`}>DÁN LỜI</button>
                </div>
              </div>

              <textarea
                value={useCustomLyrics ? customLyrics : prompt}
                onChange={(e) => useCustomLyrics ? setCustomLyrics(e.target.value) : setPrompt(e.target.value)}
                placeholder={useCustomLyrics ? "Dán lời bài hát của bạn vào đây..." : "Gợi ý: Một bài hát EDM sôi động nói về sự tự do và khát vọng tuổi trẻ..."}
                className="w-full bg-white/5 border border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 rounded-2xl text-sm p-5 h-36 resize-none transition-all placeholder:text-white/10"
              />

              <div className="mt-6">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-4 tracking-wider">Chọn thể loại (Beat)</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => setGenre(g)} className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all ${genre === g ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-600/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>{g}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full mt-6 py-3 flex items-center justify-center gap-2 text-white/40 text-[10px] font-bold uppercase bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                Cài đặt nghệ sĩ {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-5 bg-black/40 rounded-3xl space-y-5 border border-white/5 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/30 uppercase flex items-center gap-2"><User size={12}/> Giọng ca phỏng theo</label>
                    <div className="grid grid-cols-2 gap-2">
                        {ARTISTS.map(a => (
                            <button 
                                key={a.name}
                                onClick={() => setVoiceSettings({...voiceSettings, singerStyle: a.name})}
                                className={`text-[10px] p-2.5 rounded-xl border text-left transition-all ${voiceSettings.singerStyle === a.name ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-white/5'}`}
                            >
                                <p className="font-bold">{a.name}</p>
                                <p className="opacity-40 text-[8px]">{a.desc}</p>
                            </button>
                        ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase">Vùng miền</label>
                      <select value={voiceSettings.region} onChange={(e) => setVoiceSettings({...voiceSettings, region: e.target.value as any})} className="w-full bg-[#111] border-white/10 rounded-xl text-xs p-3">
                        <option value="north">Miền Bắc</option>
                        <option value="central">Miền Trung</option>
                        <option value="south">Miền Nam</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase">Độ tuổi</label>
                      <select value={voiceSettings.age} onChange={(e) => setVoiceSettings({...voiceSettings, age: e.target.value as any})} className="w-full bg-[#111] border-white/10 rounded-xl text-xs p-3">
                        <option value="young">Thanh niên</option>
                        <option value="mature">Trung niên</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={step !== GenerationStep.IDLE}
                className="mt-8 w-full py-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-[1.5rem] font-black text-xs tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30"
              >
                {step === GenerationStep.IDLE ? <><Sparkles size={18} /> <span>Bắt đầu tạo nhạc</span></> : <><div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> <span>Đang xử lý {step === GenerationStep.WRITING_LYRICS ? 'lời...' : 'giọng...'}</span></>}
              </button>
            </div>
            
            {statusText && <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-[10px] text-purple-300 font-bold animate-pulse text-center tracking-widest uppercase">{statusText}</div>}
            {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-2 font-medium"><AlertCircle size={16}/> {errorMsg}</div>}
          </div>

          {/* Player & Hiển thị bài hát */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="glass-morphism rounded-[3rem] p-10 border-white/10 relative overflow-hidden shadow-2xl">
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative group">
                        <img src={currentTrack.thumbnail} className="w-48 h-48 rounded-[2rem] shadow-2xl object-cover ring-4 ring-white/5 transition-transform duration-500 group-hover:scale-105" alt="" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex items-center justify-center">
                            <Download className="text-white cursor-pointer hover:scale-110 transition-transform" />
                        </div>
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <span className="bg-purple-600/20 text-purple-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">Mới ra mắt</span>
                      <h3 className="text-4xl font-black mb-3 leading-tight tracking-tighter">{currentTrack.title}</h3>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <p className="text-white/40 text-xs font-bold flex items-center gap-2"><User size={14}/> Ca sĩ: {currentTrack.settings?.singerStyle}</p>
                        <p className="text-white/40 text-xs font-bold flex items-center gap-2"><Music size={14}/> Beat: {currentTrack.genre}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 flex items-center gap-6">
                    <button onClick={togglePlay} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all shrink-0">
                      {isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="ml-1" />}
                    </button>
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">
                            <span>Spectrum</span>
                            <span className="flex items-center gap-1"><Volume2 size={12}/> Stereo Mix</span>
                        </div>
                        <div className="h-24 bg-black/40 rounded-3xl overflow-hidden border border-white/5">
                           <Visualizer audioElement={audioRef.current} isPlaying={isPlaying} />
                        </div>
                    </div>
                  </div>
                  
                  {/* Hai luồng âm thanh trộn lại */}
                  <audio ref={audioRef} src={currentTrack.audioUrl} onEnded={() => { setIsPlaying(false); if(beatRef.current) beatRef.current.pause(); }} className="hidden" />
                  <audio ref={beatRef} src={currentTrack.beatUrl} className="hidden" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-morphism p-8 rounded-[2.5rem] border-white/5 h-80 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-black mb-6 text-white/30 uppercase tracking-widest flex items-center gap-2"><Send size={14} className="text-purple-500"/> Lời bài hát</h4>
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line font-medium">{currentTrack.lyrics}</p>
                  </div>
                  <div className="glass-morphism p-8 rounded-[2.5rem] border-white/5 h-80">
                    <h4 className="text-[10px] font-black mb-6 text-white/30 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-blue-500"/> Chi tiết sản xuất</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Nhịp điệu</span><span className="text-xs font-black">4/4 Tempo</span></div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Công nghệ</span><span className="text-xs font-black">Gemini 2.5 Audio</span></div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[11px] text-white/30 font-bold uppercase">Xử lý giọng</span><span className="text-xs font-black">Melodic TTS</span></div>
                      <div className="flex justify-between items-center py-2"><span className="text-[11px] text-white/30 font-bold uppercase">Mixing</span><span className="text-xs font-black">Auto-Layering</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[32rem] flex flex-col items-center justify-center text-white/5 border-2 border-dashed border-white/5 rounded-[3rem] animate-pulse">
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Music size={64} className="opacity-20" />
                </div>
                <p className="text-xl font-black tracking-widest opacity-20 uppercase">Hãy bắt đầu hành trình âm nhạc của bạn</p>
                <p className="text-xs mt-2 opacity-10">Nhập mô tả ở bên trái để AI bắt đầu sáng tác</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
