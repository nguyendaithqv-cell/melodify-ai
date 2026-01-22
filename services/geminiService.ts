
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SongMetadata, VoiceSettings } from "../types";

const getArtistDescription = (name: string): string => {
  const descriptions: Record<string, string> = {
    'Sơn Tùng M-TP': 'Trẻ trung, hiện đại, có chút ngông nghênh nhưng chuyên nghiệp.',
    'Mỹ Tâm': 'Nồng nàn, cảm xúc, giọng hát nội lực và sâu sắc.',
    'Hà Anh Tuấn': 'Văn minh, lịch lãm, ballad sang trọng.',
    'Đen Vâu': 'Rap giàu ý nghĩa, mộc mạc, chân chất.',
    'Hoàng Thùy Linh': 'Dân gian đương đại, sôi động, ma mị.',
    'Hồ Ngọc Hà': 'Quyến rũ, giọng khàn đặc trưng, đẳng cấp.',
    'Đàm Vĩnh Hưng': 'Nhiệt huyết, Bolero và nhạc trẻ pha trộn.',
    'Tùng Dương': 'Hàn lâm, kỹ thuật đỉnh cao, độc lạ.',
    'Trúc Nhân': 'Sáng tạo, châm biếm nhẹ nhàng, xử lý tinh tế.',
    'HIEUTHUHAI': 'Rap hiện đại, lôi cuốn, đậm chất Gen Z.'
  };
  return descriptions[name] || '';
};

export const generateSongStructure = async (
  prompt: string, 
  genre: string, 
  customLyrics?: string
): Promise<SongMetadata> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình API_KEY trong GitHub Secrets!");

  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = customLyrics 
    ? `Dựa trên lời bài hát: "${customLyrics}", hãy đặt tiêu đề phù hợp với thể loại "${genre}".`
    : `Hãy viết lời bài hát chủ đề: "${prompt}", thể loại: "${genre}". Bao gồm các phần Verse và Chorus. Trả về JSON.`;

  try {
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
          required: ["title", "genre", "mood", "lyrics", "tempo"]
        }
      }
    });

    const result = response.text;
    if (!result) throw new Error("AI không phản hồi lời bài hát.");
    
    const parsed = JSON.parse(result);
    if (customLyrics) parsed.lyrics = customLyrics;
    
    return parsed as SongMetadata;
  } catch (error) {
    console.error("Lỗi tạo lời:", error);
    throw error;
  }
};

export const generateSpeechAudio = async (
  text: string, 
  settings: VoiceSettings
): Promise<Uint8Array | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  const regionMap = { north: 'miền Bắc', central: 'miền Trung', south: 'miền Nam' };
  const ageMap = { child: 'trẻ em', young: 'thanh niên', mature: 'trung niên', senior: 'người già' };
  const artistDesc = settings.singerStyle ? getArtistDescription(settings.singerStyle) : '';
  
  const prompt = `Thể hiện lời bài hát sau bằng giọng ${regionMap[settings.region]}, độ tuổi ${ageMap[settings.age]}. 
    ${settings.singerStyle !== 'Không có' ? `Phong cách: ${settings.singerStyle} (${artistDesc}).` : ''}
    Lời: ${text.substring(0, 1000)}`; // Giới hạn độ dài để ổn định

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
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Lỗi tạo âm thanh (TTS):", error);
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
