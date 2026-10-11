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
  // From the first sound to the last; the Time criterion is rated on it
  spoken_s: number;
};

// What Gemma reports after listening to one segment
export type SegmentObservation = {
  tone?: string;
  pace?: "slow" | "conversational" | "fast";
  filler_words?: string[];
  topics?: string[];
  // Short statements of what the speaker says, used to compare the speech with the deck
  key_points?: string[];
  observations?: string;
};

// Rubric level from 0 to 4, with the measurement or the observation it rests on
export type Criterion = { name: string; level: number; reason?: string };

// SHA-256 of the salt followed by the uploaded file. The salt is random per analysis, so the hash
// names the file without revealing anything about it until the salt is shown.
export type FileFingerprint = { sha256: string; salt: string; bytes: number };

// What produced an analysis: the model and a hash over the service's prompts, rubrics and limits
export type AnalysisSetup = { model: string; dtype: string | null; slide_tokens: number; code_sha256: string };

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
  // 0-100 in steps of 5, computed from the criterion levels; null when no criterion got a valid level
  pitch_score?: number | null;
  // Levels given by Gemma, except filler words, which follow from the count it heard
  criteria?: Criterion[];
  // Expected pitch topics that Gemma did not find in any segment
  missing_topics?: string[];
  insights?: string[];
  feedback?: { at_s: number | null; text: string }[];
};

export type AudioAnalysis = {
  duration_s: number;
  // The event's limit for the pitch, when one was given; the Time criterion is rated against it
  time_limit_s?: number | null;
  model: string;
  prosody: ProsodyAnalysis | null;
  pauses: PauseAnalysis;
  // Counted from the filler words Gemma heard in each segment
  filler_words: { count: number; per_minute: number };
  segments: Segment[];
  summary: PitchSummary | null;
  file: FileFingerprint;
  setup: AnalysisSetup;
};

// Read from the PDF file; sizes are a share of the slide height
export type SlideMeasurements = {
  words: number;
  characters: number;
  smallest_text_pct: number;
  largest_text_pct: number;
  small_text_share: number;
  // null when the text colour or its surroundings could not be read
  low_contrast_share: number | null;
  lowest_contrast: number | null;
  fonts: Record<string, number>;
};

// What Gemma reports after reading one slide
export type SlideObservation = {
  title?: string;
  message?: string;
  message_count?: "one" | "several";
  topics?: string[];
  key_points?: string[];
  observations?: string;
};

export type Slide = {
  number: number;
  // null for a page without a text layer
  measurements: SlideMeasurements | null;
  // null when Gemma's reply did not parse; raw holds the reply then
  observations: SlideObservation | null;
  raw?: string;
};

export type DeckSummary = {
  // 0-100 in steps of 5, computed from the criterion levels; null when no criterion could be rated
  slide_score: number | null;
  // Gemma gives the levels for consistency and structure; the rest follow from counts and measurements
  criteria: Criterion[];
  insights: string[];
  feedback: { slide: number | null; text: string }[];
};

export type DeckAnalysis = {
  model: string;
  page_count: number;
  pages_analyzed: number;
  text_layer: boolean;
  measurements: { words_median: number; words_max: number; smallest_text_pct: number; fonts: string[] } | null;
  // For each expected topic, the slides that explain it; null when Gemma gave no such map
  topic_slides: Record<string, number[]> | null;
  slides: Slide[];
  summary: DeckSummary | null;
  file: FileFingerprint;
  setup: AnalysisSetup;
};

// Whether the speech follows the deck; a report next to the two scores, not part of either
export type Alignment = {
  deck_points: number;
  unexplained: { slide: number; point: string }[];
  // 0-4, from the share of the deck's key points the speech never explains
  coverage_level: number;
  contradictions: { slide: number | null; at_s: number | null; slide_says: string; speaker_says: string }[];
  summary: string;
  recommendations: string[];
};

export type PitchCheck = {
  pitch: AudioAnalysis;
  deck: DeckAnalysis;
  // null when the speech and the deck could not be compared
  alignment: Alignment | null;
};

export type AnalysisStage = "measuring" | "listening" | "scoring" | "reading" | "reviewing" | "aligning";

export type AnalysisEvent<Result> =
  | { type: "progress"; stage: AnalysisStage; progress: number }
  | { type: "result"; data: Result }
  | { type: "error"; message: string };
