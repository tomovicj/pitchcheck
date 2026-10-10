export type SpeechAnalysis = {
  language: string;
  transcript: string;
  word_count: number;
  words_per_minute?: number | null;
  articulation_rate_wpm?: number | null;
  pause_count?: number;
  total_pause_s?: number;
  mean_pause_s?: number;
  longest_pause_s?: number;
  filler_count?: number;
  fillers?: string[];
};

export type ProsodyAnalysis = {
  pitch_mean_hz: number;
  pitch_median_hz: number;
  pitch_p5_hz: number;
  pitch_p95_hz: number;
  pitch_std_semitones: number;
  pitch_range_semitones: number;
  voiced_ratio: number;
  intensity_mean_db: number;
  intensity_std_db: number;
};

export type EmotionWindow = {
  start_s: number;
  end_s: number;
  label: string;
  scores: Record<string, number>;
};

export type AudioAnalysis = {
  duration_s: number;
  speech: SpeechAnalysis;
  prosody: ProsodyAnalysis | null;
  emotion: {
    overall: Record<string, number>;
    timeline: EmotionWindow[];
  };
};

export type AnalysisStage = "transcribing" | "analyzing_pitch" | "detecting_emotion";

export type AnalysisEvent =
  | { type: "progress"; stage: AnalysisStage; progress: number }
  | { type: "result"; data: AudioAnalysis }
  | { type: "error"; message: string };
