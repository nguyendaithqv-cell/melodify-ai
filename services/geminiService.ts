
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SongMetadata, VoiceSettings } from "../types";

// Helper to get artist description
const getArtistDescription = (name: string): string => {
  // We can't import App constants here easily in some setups, so we define a local lookup
  const descriptions: Record<string, string> = {
    'Sơn Tùng M-TP': '"Ông hoàng truyền thông" của V-Pop với phong cách trẻ trung, hiện đại và sức ảnh hưởng quốc tế.',
    'Mỹ Tâm': '"Họa mi tóc nâu" với giọng hát nồng nàn, cảm xúc và sự nghiệp bền bỉ hơn 2 thập kỷ.',
    'Hà Anh Tuấn': 'Phong cách âm nhạc văn minh, lịch lãm, gắn liền với những bản ballad tự sự và sang trọng.',
    'Đen Vâu': 'Rapper có sức ảnh hưởng lớn với những bản nhạc rap giàu ý nghĩa, đời thường và chân chất.',
    'Hoàng Thùy Linh': 'Người tiên phong đưa các chất liệu văn hóa dân gian Việt Nam vào âm nhạc hiện đại, sôi động.',
    'Hồ Ngọc Hà': '"Nữ hoàng giải trí" với chất giọng khàn đặc trưng, quyến rũ và phong cách trình diễn đẳng cấp.',
    'Đàm Vĩnh Hưng': '"Ông hoàng nhạc Việt" với tầm ảnh hưởng lớn trong dòng nhạc Bolero và nhạc trẻ.',
    'Tùng Dương': 'Nghệ sĩ theo đuổi phong cách âm nhạc hàn lâm, ma mị và kỹ thuật thanh nhạc điêu luyện.',
    'Trúc Nhân': 'Cá tính âm nhạc độc đáo, sáng tạo với những thông điệp xã hội sâu sắc và cách xử lý tinh tế.',
    'HIEUTHUHAI': 'Đại diện tiêu biểu cho Gen Z, thành công với dòng nhạc Rap/Hip-hop hiện đại và lôi cuốn.'
  };
  return descriptions[name] || '';
};

export const generateSongStructure = async (
  prompt: string, 
  genre: string, 
  customLyrics?: string
): Promise<SongMetadata> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const instruction = customLyrics 
    ? `Dựa trên lời bài hát có sẵn: "${customLyrics}", hãy tạo tiêu đề, thể loại "${genre}" và tâm trạng phù hợp.`
    : `Hãy tạo một bài hát với chủ đề: "${prompt}", thể loại: "${genre}". 
       Lời bài hát nên bao gồm Verse 1, Chorus, Verse 2, Bridge, và Outro.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: instruction,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          genre: { type: Type.STRING },
          mood: { type: Type.STRING },
          lyrics: { type: Type.STRING },
          tempo: { type: Type.NUMBER }
        },
        required: ["title", "genre", "mood", "lyrics", "tempo"],
        propertyOrdering: ["title", "genre", "mood", "lyrics", "tempo"]
      }
    }
  });

  const result = response.text;
  const parsed = JSON.parse(result || '{}');
  
  if (customLyrics) {
    parsed.lyrics = customLyrics;
  }
  
  return parsed as SongMetadata;
};

export const generateSpeechAudio = async (
  text: string, 
  settings: VoiceSettings
): Promise<Uint8Array | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const regionMap = { north: 'miền Bắc', central: 'miền Trung', south: 'miền Nam' };
  const ageMap = { child: 'trẻ em', young: 'thanh niên', mature: 'trung niên', senior: 'người già' };
  const artistDesc = settings.singerStyle ? getArtistDescription(settings.singerStyle) : '';
  
  const prompt = `Bạn là một ca sĩ chuyên nghiệp với phong cách đặc thù. Hãy thể hiện lời bài hát sau đây.
    Yêu cầu về giọng hát:
    - Giọng: ${regionMap[settings.region]}
    - Độ tuổi: ${ageMap[settings.age]}
    ${settings.singerStyle !== 'Không có' ? `- Mô phỏng nghệ sĩ: ${settings.singerStyle} (${artistDesc})` : ''}
    
    Hãy hát/trình bày một cách truyền cảm, đúng tinh thần của nghệ sĩ và vùng miền đã chọn.
    
    Lời bài hát:
    ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: settings.voiceName as any },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
};

export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) { view.setUint8(offset + i, string.charCodeAt(i)); }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true);
    offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
};
