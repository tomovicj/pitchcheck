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

export type PauseAnalysis = {
  pause_count: number;
  total_pause_s: number;
  mean_pause_s: number;
  longest_pause_s: number;
  speaking_ratio: number;
};

// What Gemma reports after listening to one segment
export type SegmentObservation = {
  tone?: string;
  emotion?: string;
  energy?: "low" | "medium" | "high";
  pace?: "slow" | "conversational" | "fast";
  filler_words?: string[];
  topics?: string[];
  observations?: string;
};

export type Segment = {
  start_s: number;
  end_s: number;
  measurements: ProsodyAnalysis | null;
  pause_ratio: number;
  // null when Gemma's reply did not parse; raw holds the reply then
  observations: SegmentObservation | null;
  raw?: string;
};

export type PitchSummary = {
  pitch_score?: number;
  criteria?: { name: string; score: number; reason?: string }[];
  insights?: string[];
  feedback?: { at_s: number | null; text: string }[];
};

export type AudioAnalysis = {
  duration_s: number;
  model: string;
  prosody: ProsodyAnalysis | null;
  pauses: PauseAnalysis;
  segments: Segment[];
  summary: PitchSummary | null;
};

export type AnalysisStage = "measuring" | "listening" | "scoring";

export type AnalysisEvent =
  | { type: "progress"; stage: AnalysisStage; progress: number }
  | { type: "result"; data: AudioAnalysis }
  | { type: "error"; message: string };
