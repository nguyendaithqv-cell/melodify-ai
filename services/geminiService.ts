
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
    ? `Dựa trên lời bài hát: "${customLyrics}", hãy phân tích cảm xúc và đặt tiêu đề phù hợp với thể loại "${genre}". Trả về JSON.`
    : `Hãy viết lời bài hát chủ đề: "${prompt}", thể loại: "${genre}". 
       YÊU CẦU: Chia rõ [Verse], [Chorus], [Bridge]. 
       Mỗi câu hát phải có nhịp điệu. Trả về JSON.`;

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
  genre: string
): Promise<Uint8Array | null> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  // Prompt yêu cầu model Gemini hất/đọc theo giai điệu
  const prompt = `Hãy đóng vai một ca sĩ chuyên nghiệp thể loại ${genre}. 
    HÃY HÁT thật truyền cảm lời bài hát sau đây. 
    Lưu ý: Ngắt nghỉ đúng nhịp điệu, có luyến láy và biểu cảm:
    
    ${text.substring(0, 500)}`;

  try {
    // QUAN TRỌNG: Phải có responseModalities để model trả về Audio
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        // @ts-ignore
        responseModalities: ['AUDIO'],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Kore' hoặc 'Puck' thường có tông giọng tốt
            }
        }
      }
    });

    // Trích xuất dữ liệu âm thanh
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part || !part.inlineData) {
        console.warn("Model không trả về dữ liệu audio trực tiếp, thử lấy từ text (nếu có)");
        return null;
    }

    const binaryString = atob(part.inlineData.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong generateSpeechAudio:", error);
    return null;
  }
};

// Hàm chuyển đổi PCM (thường là 24kHz từ Gemini) sang WAV
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
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  for (let i = 0, offset = 44; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
};
