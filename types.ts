
export interface SongMetadata {
  title: string;
  genre: string;
  mood: string;
  lyrics: string;
  tempo: number;
}

export interface VoiceSettings {
  region: 'north' | 'central' | 'south';
  age: 'child' | 'young' | 'mature' | 'senior';
  singerStyle?: string;
  voiceName: string;
}

export interface Track {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  audioUrl?: string;
  createdAt: number;
  thumbnail: string;
  settings?: VoiceSettings;
}

export enum GenerationStep {
  IDLE = 'IDLE',
  WRITING_LYRICS = 'WRITING_LYRICS',
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  COMPLETING = 'COMPLETING'
}
