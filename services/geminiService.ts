
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SongMetadata } from "../types";

export const generateSongStructure = async (
  prompt: string, 
  genre: string
): Promise<SongMetadata> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chưa có API Key!");

  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = `Bạn là Suno AI Composer. Hãy viết lời bài hát cho chủ đề: "${prompt}" phong cách "${genre}". 
  Chia rõ: [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Trả về JSON.`;

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
    throw new Error("Không thể tạo lời bài hát.");
  }
};

export const generateSpeechAudio = async (
  text: string, 
  genre: string
): Promise<string | null> => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  const ttsPrompt = `Đóng vai ca sĩ chuyên nghiệp. Hãy hát/đọc lời bài hát sau một cách truyền cảm, ngắt nghỉ đúng nhịp điệu ${genre}:
  
  ${text.substring(0, 700)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        // @ts-ignore
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Data || null;
  } catch (error) {
    console.error("Vocal Error:", error);
    return null;
  }
};
