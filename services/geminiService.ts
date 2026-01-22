
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SongMetadata } from "../types";

export const generateSongStructure = async (
  prompt: string, 
  genre: string
): Promise<SongMetadata> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing!");

  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = `Bạn là chuyên gia sáng tác nhạc. Hãy viết lời bài hát cho chủ đề: "${prompt}" với phong cách "${genre}". 
  YÊU CẦU: Chia rõ [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Trả về định dạng JSON chuẩn.`;

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

    return JSON.parse(response.text) as SongMetadata;
  } catch (error) {
    console.error("Lyrics Error:", error);
    throw new Error("Lỗi khi tạo lời bài hát.");
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
  
  // Chỉ dẫn cho model TTS thực hiện bài hát
  const ttsPrompt = `Hãy hát hoặc đọc lời bài hát này một cách đầy cảm xúc theo phong cách ${genre}. 
  Nhấn nhá vào các đoạn điệp khúc, ngắt nghỉ đúng nhịp điệu âm nhạc:
  
  ${text.substring(0, 800)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        // @ts-ignore
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore có tông giọng rất tốt cho nhạc
            },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) return null;

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Vocal Error:", error);
    return null;
  }
};

export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
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

  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
};
