
import { GoogleGenAI, Type } from "@google/genai";
import { SongMetadata, VoiceSettings } from "../types";

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
    ? `Dựa trên lời bài hát: "${customLyrics}", hãy phân tích cảm xúc và đặt tiêu đề phù hợp với thể loại "${genre}".`
    : `Hãy viết lời bài hát chủ đề: "${prompt}", thể loại: "${genre}". 
       YÊU CẦU: Chia rõ [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. 
       Mỗi câu hát phải có số âm tiết cân đối. Trả về JSON.`;

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
  settings: VoiceSettings,
  genre: string
): Promise<Uint8Array | null> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  // Sử dụng model Native Audio để có khả năng "hát" tốt hơn
  const prompt = `Bạn là một ca sĩ chuyên nghiệp phong cách ${genre}. 
    HÃY HÁT (SING) lời bài hát này một cách đầy cảm xúc, có nhịp điệu mạnh mẽ, 
    ngân nga và luyến láy ở những đoạn điệp khúc.
    YÊU CẦU: Không được đọc như robot, phải có cao độ và ngắt nghỉ như đang biểu diễn trên sân khấu.
    
    LỜI BÀI HÁT:
    ${text.substring(0, 1000)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: [{ parts: [{ text: prompt }] }],
    });

    // Trích xuất dữ liệu âm thanh từ response parts
    let audioData: string | undefined;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.mimeType.includes('audio')) {
        audioData = part.inlineData.data;
        break;
      }
    }

    if (!audioData) return null;

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Lỗi tạo âm thanh (Native Audio):", error);
    return null;
  }
};

// Hàm chuyển đổi PCM sang WAV chuẩn
export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
};
