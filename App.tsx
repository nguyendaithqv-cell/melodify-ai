
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Sparkles, History, Send, Download, Plus, Mic, RotateCcw, ChevronDown, ChevronUp, User, Globe, Baby, Info } from 'lucide-react';
import { generateSongStructure, generateSpeechAudio, pcmToWav } from './services/geminiService';
import { Track, GenerationStep, VoiceSettings } from './types';
import Visualizer from './components/Visualizer';

const GENRES = ['Pop', 'Ballad', 'Rock', 'EDM', 'Bolero', 'Lofi', 'Hip-hop', 'R&B'];

export const ARTISTS = [
  { name: 'Không có', desc: 'Sử dụng giọng AI mặc định không mô phỏng.' },
  { name: 'Sơn Tùng M-TP', desc: '"Ông hoàng truyền thông" của V-Pop với phong cách trẻ trung, hiện đại và sức ảnh hưởng quốc tế.' },
  { name: 'Mỹ Tâm', desc: '"Họa mi tóc nâu" với giọng hát nồng nàn, cảm xúc và sự nghiệp bền bỉ hơn 2 thập kỷ.' },
  { name: 'Hà Anh Tuấn', desc: 'Phong cách âm nhạc văn minh, lịch lãm, gắn liền với những bản ballad tự sự và sang trọng.' },
  { name: 'Đen Vâu', desc: 'Rapper có sức ảnh hưởng lớn với những bản nhạc rap giàu ý nghĩa, đời thường và chân chất.' },
  { name: 'Hoàng Thùy Linh', desc: 'Người tiên phong đưa các chất liệu văn hóa dân gian Việt Nam vào âm nhạc hiện đại, sôi động.' },
  { name: 'Hồ Ngọc Hà', desc: '"Nữ hoàng giải trí" với chất giọng khàn đặc trưng, quyến rũ và phong cách trình diễn đẳng cấp.' },
  { name: 'Đàm Vĩnh Hưng', desc: '"Ông hoàng nhạc Việt" với tầm ảnh hưởng lớn trong dòng nhạc Bolero và nhạc trẻ.' },
  { name: 'Tùng Dương', desc: 'Nghệ sĩ theo đuổi phong cách âm nhạc hàn lâm, ma mị và kỹ thuật thanh nhạc điêu luyện.' },
  { name: 'Trúc Nhân', desc: 'Cá tính âm nhạc độc đáo, sáng tạo với những thông điệp xã hội sâu sắc và cách xử lý tinh tế.' },
  { name: 'HIEUTHUHAI', desc: 'Đại diện tiêu biểu cho Gen Z, thành công với dòng nhạc Rap/Hip-hop hiện đại và lôi cuốn.' }
];

const VOICE_MODELS = [
  { id: 'Kore', name: 'Nữ truyền cảm', type: 'female' },
  { id: 'Fenrir', name: 'Nam trầm ấm', type: 'male' },
  { id: 'Puck', name: 'Trẻ trung', type: 'youth' },
  { id: 'Charon', name: 'Chững chạc', type: 'mature' },
  { id: 'Zephyr', name: 'Bay bổng', type: 'airy' }
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [useCustomLyrics, setUseCustomLyrics] = useState(false);
  const [genre, setGenre] = useState('Pop');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Voice Settings
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

  const selectedArtist = ARTISTS.find(a => a.name === voiceSettings.singerStyle);

  const handleGenerate = async () => {
    if (!useCustomLyrics && !prompt.trim()) return;
    if (useCustomLyrics && !customLyrics.trim()) return;

    try {
      setStep(GenerationStep.WRITING_LYRICS);
      setStatusText('Đang thiết kế lời bài hát theo phong cách nghệ sĩ...');
      
      const songData = await generateSongStructure(prompt, genre, useCustomLyrics ? customLyrics : undefined);
      
      setStep(GenerationStep.GENERATING_AUDIO);
      setStatusText(`Đang hòa âm giọng hát mô phỏng ${voiceSettings.singerStyle}...`);
      
      const audioBytes = await generateSpeechAudio(songData.lyrics, voiceSettings);
      
      let audioUrl = '';
      if (audioBytes) {
        const pcmData = new Int16Array(audioBytes.buffer);
        const wavBlob = pcmToWav(pcmData, 24000);
        audioUrl = URL.createObjectURL(wavBlob);
      }

      const newTrack: Track = {
        id: Math.random().toString(36).substr(2, 9),
        title: songData.title,
        genre: songData.genre,
        lyrics: songData.lyrics,
        audioUrl: audioUrl,
        createdAt: Date.now(),
        thumbnail: `https://picsum.photos/seed/${Math.random()}/400/400`,
        settings: { ...voiceSettings }
      };

      setTracks([newTrack, ...tracks]);
      setCurrentTrack(newTrack);
      setStep(GenerationStep.IDLE);
      setPrompt('');
      setStatusText('');
    } catch (error) {
      console.error("Generation failed:", error);
      setStep(GenerationStep.IDLE);
      setStatusText('Lỗi: ' + (error as Error).message);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#080808] text-white">
      {/* Sidebar */}
      <aside className="w-full md:w-80 glass-morphism p-6 flex flex-col border-r border-white/5 z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Music className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter gradient-text">MELODIFY</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Studio AI Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-white/40 mb-4 px-2 text-xs font-bold uppercase tracking-widest">
          <History className="w-3 h-3" />
          <span>Thư viện sáng tạo</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => { setCurrentTrack(track); setIsPlaying(false); }}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all border ${
                currentTrack?.id === track.id ? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-transparent'
              }`}
            >
              <img src={track.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
              <div className="text-left overflow-hidden">
                <p className="font-bold truncate text-sm">{track.title}</p>
                <p className="text-[10px] text-white/40 truncate">{track.genre} • {track.settings?.singerStyle}</p>
              </div>
            </button>
          ))}
          {tracks.length === 0 && <p className="text-white/20 text-center py-10 text-sm">Chưa có bài hát nào</p>}
        </div>

        <button className="mt-6 flex items-center justify-center gap-2 w-full py-4 px-4 bg-white text-black hover:bg-white/90 rounded-2xl transition-all font-bold text-sm">
          <Plus className="w-4 h-4" />
          <span>Dự án mới</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-10 max-w-6xl mx-auto w-full overflow-y-auto">
        <section className="mb-10">
          <h2 className="text-5xl font-black mb-4 tracking-tight leading-tight">
            Nghệ thuật AI <br/><span className="text-indigo-500">Thuần Việt.</span>
          </h2>
          <p className="text-white/40 max-w-2xl text-lg">Hệ thống mô phỏng phong cách 10 nghệ sĩ hàng đầu V-Pop và giọng hát 3 miền Bắc - Trung - Nam.</p>
        </section>

        {/* Workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          {/* Left: Input Panel */}
          <div className="xl:col-span-5 space-y-6">
            <div className="glass-morphism rounded-[2.5rem] p-6 border-white/10 shadow-2xl relative">
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Thiết lập bài hát</span>
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                  <button 
                    onClick={() => setUseCustomLyrics(false)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!useCustomLyrics ? 'bg-white/10 text-white' : 'text-white/30'}`}
                  >AI VIẾT LỜI</button>
                  <button 
                    onClick={() => setUseCustomLyrics(true)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${useCustomLyrics ? 'bg-white/10 text-white' : 'text-white/30'}`}
                  >DÁN LỜI</button>
                </div>
              </div>

              {useCustomLyrics ? (
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="Dán lời bài hát (Phân đoạn: Verse, Chorus...) vào đây..."
                  className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 focus:ring-0 rounded-2xl text-lg p-5 resize-none h-40 placeholder:text-white/10 transition-all"
                />
              ) : (
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Một bài hát hip-hop về Sài Gòn sôi động..."
                  className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 focus:ring-0 rounded-2xl text-lg p-5 resize-none h-40 placeholder:text-white/10 transition-all"
                />
              )}

              {/* Genre selection chips */}
              <div className="mt-6">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 px-2">Dòng nhạc</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        genre === g ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >{g}</button>
                  ))}
                </div>
              </div>

              {/* Advanced UI toggler */}
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full mt-6 py-4 flex items-center justify-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                Cấu hình Nghệ sĩ & Vùng miền
              </button>

              {/* Advanced Panel */}
              {showAdvanced && (
                <div className="mt-4 p-5 bg-black/40 rounded-3xl border border-white/5 space-y-6 animate-in slide-in-from-top-4 duration-300">
                  
                  {/* Singer Selection with Bio */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                      <User className="w-3 h-3" /> Phong cách Nghệ sĩ V-Pop
                    </label>
                    <select 
                      value={voiceSettings.singerStyle}
                      onChange={(e) => setVoiceSettings({...voiceSettings, singerStyle: e.target.value})}
                      className="w-full bg-[#111] border-white/10 rounded-xl text-sm p-3 focus:ring-indigo-500"
                    >
                      {ARTISTS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                    </select>
                    {selectedArtist && selectedArtist.name !== 'Không có' && (
                      <div className="flex gap-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-white/50 italic leading-relaxed">{selectedArtist.desc}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                        <Globe className="w-3 h-3" /> Vùng miền
                      </label>
                      <div className="grid grid-cols-1 gap-1">
                        {['north', 'central', 'south'].map(r => (
                          <button
                            key={r}
                            onClick={() => setVoiceSettings({...voiceSettings, region: r as any})}
                            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                              voiceSettings.region === r ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent text-white/30'
                            }`}
                          >{r === 'north' ? 'Giọng Bắc' : r === 'central' ? 'Giọng Trung' : 'Giọng Nam'}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                        <Baby className="w-3 h-3" /> Độ tuổi
                      </label>
                      <div className="grid grid-cols-1 gap-1">
                        {['child', 'young', 'mature', 'senior'].map(a => (
                          <button
                            key={a}
                            onClick={() => setVoiceSettings({...voiceSettings, age: a as any})}
                            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                              voiceSettings.age === a ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent text-white/30'
                            }`}
                          >{a === 'child' ? 'Trẻ em' : a === 'young' ? 'Thanh niên' : a === 'mature' ? 'Trung niên' : 'Người già'}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                      Mẫu âm sắc AI
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {VOICE_MODELS.map(vm => (
                        <button
                          key={vm.id}
                          onClick={() => setVoiceSettings({...voiceSettings, voiceName: vm.id})}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                            voiceSettings.voiceName === vm.id ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10 text-white/40'
                          }`}
                        >{vm.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={step !== GenerationStep.IDLE}
                className="mt-8 w-full py-5 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 rounded-3xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {step === GenerationStep.IDLE ? (
                  <>
                    <Sparkles className="w-6 h-6" />
                    <span>XUẤT BẢN NGAY</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="animate-pulse">ĐANG HÒA ÂM...</span>
                  </>
                )}
              </button>
            </div>
            
            {statusText && (
              <div className="flex items-center gap-3 px-6 py-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                <p className="text-indigo-300 text-sm font-bold uppercase tracking-widest">{statusText}</p>
              </div>
            )}
          </div>

          {/* Right: Player Panel */}
          <div className="xl:col-span-7">
            {currentTrack ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="glass-morphism rounded-[3rem] p-10 border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8">
                    <button className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5">
                      <Download className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative group">
                      <img src={currentTrack.thumbnail} className="w-56 h-56 rounded-[2.5rem] shadow-2xl object-cover ring-8 ring-white/5 group-hover:scale-105 transition-transform duration-500" alt="" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]">
                        <button onClick={togglePlay} className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-white/20">
                           {isPlaying ? <Pause className="text-black" /> : <Play className="text-black fill-black ml-1" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-center md:text-left">
                      <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{currentTrack.genre}</span>
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Studio AI</span>
                      </div>
                      <h3 className="text-4xl font-black mb-3 leading-tight truncate max-w-md">{currentTrack.title}</h3>
                      <div className="flex flex-col gap-2">
                        <span className="flex items-center justify-center md:justify-start gap-2 text-indigo-400 text-sm font-bold">
                          <User className="w-4 h-4"/> Phỏng theo: {currentTrack.settings?.singerStyle}
                        </span>
                        <span className="flex items-center justify-center md:justify-start gap-2 text-white/40 text-xs font-medium">
                          <Globe className="w-3.5 h-3.5"/> Giọng {currentTrack.settings?.region === 'north' ? 'Bắc' : currentTrack.settings?.region === 'central' ? 'Trung' : 'Nam'} ({currentTrack.settings?.age})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 space-y-6">
                    <div className="flex items-center gap-6">
                       <button onClick={togglePlay} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-2xl shadow-white/10 hover:scale-105 active:scale-95 transition-all">
                        {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                      </button>
                      <div className="flex-1">
                        <Visualizer audioElement={audioRef.current} isPlaying={isPlaying} />
                      </div>
                    </div>
                  </div>

                  {currentTrack.audioUrl && (
                    <audio ref={audioRef} src={currentTrack.audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-morphism p-8 rounded-[2.5rem] border-white/5 h-[400px] flex flex-col">
                    <h4 className="text-lg font-black mb-6 flex items-center gap-3">
                      <Send className="w-5 h-5 text-indigo-500" />
                      Lời bài hát
                    </h4>
                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar whitespace-pre-line text-white/60 leading-relaxed font-medium text-sm">
                      {currentTrack.lyrics}
                    </div>
                  </div>

                  <div className="glass-morphism p-8 rounded-[2.5rem] border-white/5">
                    <h4 className="text-lg font-black mb-6 flex items-center gap-3 text-fuchsia-500">
                      Cấu hình sản xuất
                    </h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Nghệ sĩ mô phỏng', value: currentTrack.settings?.singerStyle },
                        { label: 'Phong cách vùng', value: currentTrack.settings?.region === 'north' ? 'Bắc Bộ' : currentTrack.settings?.region === 'central' ? 'Trung Bộ' : 'Nam Bộ' },
                        { label: 'Độ tuổi giọng', value: currentTrack.settings?.age },
                        { label: 'Phòng thu', value: 'Gemini 2.5 Pro (TTS)' },
                        { label: 'Chất lượng', value: 'Lossless 44.1kHz' }
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-3 border-b border-white/5">
                          <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                          <span className="text-xs font-bold text-white/80">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center text-white/5 border-4 border-dashed border-white/5 rounded-[4rem]">
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Music className="w-16 h-16" />
                </div>
                <p className="text-2xl font-black">SẴN SÀNG SÁNG TẠO?</p>
                <p className="text-sm font-bold opacity-40 mt-2 uppercase tracking-widest">Hãy nhập mô tả bên trái để bắt đầu</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
