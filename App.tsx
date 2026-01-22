
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, History, Send, Download, Plus, Mic, RotateCcw, ChevronDown, ChevronUp, User, Globe, Baby, Info, AlertCircle } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep, VoiceSettings } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'R&B'];

const ARTISTS = [
  { name: 'Không có', desc: 'Sử dụng giọng AI mặc định.' },
  { name: 'Sơn Tùng M-TP', desc: 'Phong cách trẻ trung, hiện đại.' },
  { name: 'Mỹ Tâm', desc: 'Nồng nàn, cảm xúc.' },
  { name: 'Hà Anh Tuấn', desc: 'Lịch lãm, sang trọng.' },
  { name: 'Đen Vâu', desc: 'Mộc mạc, chân chất.' },
  { name: 'Hoàng Thùy Linh', desc: 'Dân gian đương đại.' },
  { name: 'Hồ Ngọc Hà', desc: 'Quyến rũ, đặc trưng.' },
  { name: 'Đàm Vĩnh Hưng', desc: 'Nhiệt huyết, truyền cảm.' },
  { name: 'Tùng Dương', desc: 'Hàn lâm, kỹ thuật.' },
  { name: 'Trúc Nhân', desc: 'Cá tính, tinh tế.' },
  { name: 'HIEUTHUHAI', desc: 'Rap hiện đại, lôi cuốn.' }
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
    singerStyle: 'Không có',
    voiceName: 'Kore'
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [statusText, setStatusText] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!useCustomLyrics && !prompt.trim()) return;
    setErrorMsg('');

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      setStatusText('AI đang sáng tác lời bài hát...');
      
      const songData = await generateSongStructure(prompt, genre, useCustomLyrics ? customLyrics : undefined);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      setStatusText(`Đang hòa âm giọng hát phong cách ${voiceSettings.singerStyle}...`);
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, voiceSettings);
      
      if (!audioBytes) throw new Error("Không thể tạo tệp âm thanh. Vui lòng thử lại.");

      const pcmData = new Int16Array(audioBytes.buffer);
      const wavBlob = pcmToWav(pcmData, 24000);
      const audioUrl = URL.createObjectURL(wavBlob);

      const newTrack: Track = {
        id: Date.now().toString(),
        title: songData.title,
        genre: songData.genre,
        lyrics: songData.lyrics,
        audioUrl: audioUrl,
        createdAt: Date.now(),
        thumbnail: `https://picsum.photos/seed/${Date.now()}/400/400`,
        settings: { ...voiceSettings }
      };

      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      setPrompt('');
      setStatusText('');
    } catch (error: any) {
      console.error("Lỗi ứng dụng:", error);
      setErrorMsg(error.message || 'Có lỗi xảy ra trong quá trình tạo nhạc.');
      setStep(GenerationStep.IDLE);
      setStatusText('');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#080808] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-80 glass-morphism p-6 flex-col border-r border-white/5">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-600 to-indigo-700 rounded-xl flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black gradient-text">MELODIFY</h1>
            <p className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Studio Edition</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => { setCurrentTrack(track); setIsPlaying(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                currentTrack?.id === track.id ? 'bg-white/10 border-white/20 shadow-lg' : 'hover:bg-white/5 border-transparent'
              }`}
            >
              <img src={track.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
              <div className="text-left overflow-hidden">
                <p className="font-bold truncate text-sm">{track.title}</p>
                <p className="text-[10px] text-white/40">{track.genre}</p>
              </div>
            </button>
          ))}
          {tracks.length === 0 && <p className="text-white/20 text-center py-10 text-xs">Chưa có bài hát nào</p>}
        </div>

        <button onClick={() => {setCurrentTrack(null); setPrompt('');}} className="mt-6 flex items-center justify-center gap-2 w-full py-4 bg-white text-black hover:bg-white/90 rounded-2xl transition-all font-bold text-sm">
          <Plus className="w-4 h-4" />
          <span>Dự án mới</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar">
        <section className="mb-8">
          <h2 className="text-4xl font-black tracking-tight">Studio Sáng Tạo <span className="text-indigo-500">Âm Nhạc AI.</span></h2>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Input Panel */}
          <div className="xl:col-span-5 space-y-4">
            <div className="glass-morphism rounded-3xl p-6 border-white/10 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Mô tả âm nhạc</span>
                <div className="flex bg-black/40 p-1 rounded-lg">
                  <button onClick={() => setUseCustomLyrics(false)} className={`px-3 py-1 text-[9px] font-bold rounded-md ${!useCustomLyrics ? 'bg-white/10' : 'text-white/30'}`}>AI VIẾT LỜI</button>
                  <button onClick={() => setUseCustomLyrics(true)} className={`px-3 py-1 text-[9px] font-bold rounded-md ${useCustomLyrics ? 'bg-white/10' : 'text-white/30'}`}>DÁN LỜI</button>
                </div>
              </div>

              <textarea
                value={useCustomLyrics ? customLyrics : prompt}
                onChange={(e) => useCustomLyrics ? setCustomLyrics(e.target.value) : setPrompt(e.target.value)}
                placeholder={useCustomLyrics ? "Dán lời bài hát vào đây..." : "Ví dụ: Một bản Pop nhẹ nhàng về mùa thu Hà Nội..."}
                className="w-full bg-white/5 border-none focus:ring-1 focus:ring-indigo-500/50 rounded-2xl text-base p-4 h-32 resize-none transition-all"
              />

              <div className="mt-4">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-3">Dòng nhạc</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => setGenre(g)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${genre === g ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>{g}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-white/40 text-[10px] font-bold uppercase bg-white/5 rounded-xl">
                Cấu hình giọng hát {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 bg-black/40 rounded-2xl space-y-4 border border-white/5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Phong cách nghệ sĩ</label>
                    <select value={voiceSettings.singerStyle} onChange={(e) => setVoiceSettings({...voiceSettings, singerStyle: e.target.value})} className="w-full bg-[#111] border-white/10 rounded-lg text-xs p-2.5">
                      {ARTISTS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Vùng miền</label>
                      <select value={voiceSettings.region} onChange={(e) => setVoiceSettings({...voiceSettings, region: e.target.value as any})} className="w-full bg-[#111] border-white/10 rounded-lg text-xs p-2.5">
                        <option value="north">Bắc</option>
                        <option value="central">Trung</option>
                        <option value="south">Nam</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Độ tuổi</label>
                      <select value={voiceSettings.age} onChange={(e) => setVoiceSettings({...voiceSettings, age: e.target.value as any})} className="w-full bg-[#111] border-white/10 rounded-lg text-xs p-2.5">
                        <option value="young">Trẻ</option>
                        <option value="mature">Trung niên</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={step !== GenerationStep.IDLE}
                className="mt-6 w-full py-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 rounded-2xl font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {step === GenerationStep.IDLE ? <><Sparkles size={18} /> <span>TẠO NHẠC</span></> : <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> <span>ĐANG XỬ LÝ...</span></>}
              </button>
            </div>
            
            {statusText && <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 font-bold animate-pulse">{statusText}</div>}
            {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2"><AlertCircle size={14}/> {errorMsg}</div>}
          </div>

          {/* Player Panel */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="glass-morphism rounded-3xl p-8 border-white/10 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <img src={currentTrack.thumbnail} className="w-40 h-40 rounded-2xl shadow-2xl object-cover" alt="" />
                    <div className="text-center md:text-left">
                      <h3 className="text-3xl font-black mb-2 leading-tight">{currentTrack.title}</h3>
                      <p className="text-indigo-400 text-sm font-bold flex items-center justify-center md:justify-start gap-2"><User size={14}/> Nghệ sĩ: {currentTrack.settings?.singerStyle}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <button onClick={togglePlay} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all shrink-0">
                      {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
                    </button>
                    <div className="flex-1 h-20 bg-black/20 rounded-xl overflow-hidden">
                       <Visualizer audioElement={audioRef.current} isPlaying={isPlaying} />
                    </div>
                  </div>
                  {currentTrack.audioUrl && <audio ref={audioRef} src={currentTrack.audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-morphism p-6 rounded-3xl border-white/5 h-64 overflow-y-auto custom-scrollbar">
                    <h4 className="text-sm font-bold mb-4 text-white/40 uppercase tracking-widest flex items-center gap-2"><Send size={14}/> Lời bài hát</h4>
                    <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{currentTrack.lyrics}</p>
                  </div>
                  <div className="glass-morphism p-6 rounded-3xl border-white/5 h-64">
                    <h4 className="text-sm font-bold mb-4 text-white/40 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Thông tin</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-medium"><span className="text-white/20">Thể loại</span><span>{currentTrack.genre}</span></div>
                      <div className="flex justify-between text-xs font-medium"><span className="text-white/20">Vùng</span><span>{currentTrack.settings?.region}</span></div>
                      <div className="flex justify-between text-xs font-medium"><span className="text-white/20">Phòng thu</span><span>Gemini AI 2.5</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-white/5 border-2 border-dashed border-white/5 rounded-3xl">
                <Music size={64} className="mb-4 opacity-20" />
                <p className="text-lg font-bold">NHẬP Ý TƯỞNG ĐỂ BẮT ĐẦU</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
