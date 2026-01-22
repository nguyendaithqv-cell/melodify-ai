
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SongMetadata, VoiceSettings } from "../types";

const getArtistDescription = (name: string): string => {
  const descriptions: Record<string, string> = {
    'Sơn Tùng M-TP': 'Trẻ trung, hiện đại, ngắt nghỉ nhanh, dứt khoát.',
    'Mỹ Tâm': 'Nồng nàn, cảm xúc, ngân dài ở cuối câu, rung giọng nhẹ.',
    'Hà Anh Tuấn': 'Lịch lãm, hát kiểu tự sự, phát âm rõ chữ, sang trọng.',
    'Đen Vâu': 'Rap chậm, nhấn mạnh vào vần điệu, mộc mạc.',
    'Hoàng Thùy Linh': 'Ma mị, luyến láy kiểu dân gian đương đại.',
    'HIEUTHUHAI': 'Rap flow hiện đại, lôi cuốn, nhấn nhá kiểu Gen Z.'
  };
  return descriptions[name] || '';
};

export const generateSongStructure = async (
  prompt: string, 
  genre: string, 
  customLyrics?: string
): Promise<SongMetadata> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình API_KEY!");

  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = customLyrics 
    ? `Dựa trên lời bài hát: "${customLyrics}", hãy đặt tiêu đề phù hợp với thể loại "${genre}".`
    : `Hãy viết lời bài hát chủ đề: "${prompt}", thể loại: "${genre}". 
       LƯU Ý quan trọng: Lời bài hát phải có nhịp điệu rõ ràng, chia thành Verse và Chorus. 
       Mỗi dòng nên có số chữ tương đương nhau để dễ phổ nhạc. Trả về JSON.`;

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
    if (!result) throw new Error("AI không phản hồi.");
    
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
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  const regionMap = { north: 'miền Bắc', central: 'miền Trung', south: 'miền Nam' };
  const artistDesc = settings.singerStyle ? getArtistDescription(settings.singerStyle) : '';
  
  // Prompt được thiết kế để AI "hát" chứ không phải đọc
  const prompt = `Bạn là một ca sĩ chuyên nghiệp giọng ${regionMap[settings.region]}. 
    Hãy THỂ HIỆN (HÁT) lời bài hát sau đây. 
    YÊU CẦU KỸ THUẬT:
    1. Ngắt nghỉ theo nhịp phách 4/4 của bài hát.
    2. Nhấn nhá mạnh vào các từ quan trọng ở đầu câu.
    3. Ngân nga (vibrato) và kéo dài hơi ở các từ cuối mỗi câu hát.
    4. Thể hiện cảm xúc ${artistDesc ? `theo phong cách ${settings.singerStyle}: ${artistDesc}` : 'nồng nàn'}.
    
    LỜI BÀI HÁT:
    ${text.substring(0, 1500)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: settings.voiceName as any 
            },
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
