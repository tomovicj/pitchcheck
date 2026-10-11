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
  // Syllables per second of speaking, counted from the signal; null for a clip too short to measure
  syllable_rate: number | null;
};

export type PauseAnalysis = {
  pause_count: number;
  total_pause_s: number;
  mean_pause_s: number;
  longest_pause_s: number;
  // Pauses longer than 2 seconds; the Pauses criterion is rated on how many there are per minute
  long_pause_count: number;
  speaking_ratio: number;
  // From the first sound to the last; the Time criterion is rated on it
  spoken_s: number;
};

// What Gemma reports after listening to one segment
export type SegmentObservation = {
  tone?: string;
  filler_words?: string[];
  // Short statements of what the speaker says: checked against the expected topics and compared with the deck
  key_points?: string[];
  observations?: string;
};

// Rubric level from 0 to 4, with the measurement or the observation it rests on
export type Criterion = {
  name: string;
  level: number;
  reason?: string;
  // Which part of the score it belongs to; a verdict made before the groups has none
  group?: "content" | "delivery" | "design";
  // What level 4 takes
  target?: string;
  // The published advice the criterion rests on, and who gave it; url is null for a convention of the rubric
  standard?: { quote: string; by: string; url: string | null };
};

// One thing a pitch or a deck is expected to say, and where Gemma found it said
export type ChecklistItem = {
  item: string;
  found: boolean;
  // The statements Gemma named for it, as it heard or read them
  quote: string;
  at_s?: number;
  slide?: number;
  // Only for a topic that has to come with a number: whether those statements carry one
  number?: boolean;
};

// The 0-100 score of each group of criteria; a group with nothing rated is missing
export type Subscores = Partial<Record<"content" | "delivery" | "design", number>>;

// SHA-256 of the salt followed by the uploaded file. The salt is random per analysis, so the hash
// names the file without revealing anything about it until the salt is shown.
export type FileFingerprint = { sha256: string; salt: string; bytes: number };

// What produced an analysis: the model, the expected topics, and a hash over the service's prompts,
// rubrics and limits
export type AnalysisSetup = {
  model: string;
  dtype: string | null;
  slide_tokens: number;
  // Which rubric the service rates by; a service from before the Y Combinator rubric sends none
  rubric?: number;
  topics?: string[];
  code_sha256: string;
};

// The rubric this page shows results of; keep in step with RUBRIC_VERSION in services/audio/app/rubric.py
export const RUBRIC_VERSION = 2;

export type Segment = {
  start_s: number;
  end_s: number;
  measurements: ProsodyAnalysis | null;
  pause_ratio: number;
  // From the measured speaking rate, not from what Gemma hears; null when it was not measured
  pace: "slow" | "conversational" | "fast" | null;
  // null when Gemma's reply did not parse; raw holds the reply then
  observations: SegmentObservation | null;
  raw?: string;
};

export type PitchSummary = {
  // 0-100 in steps of 5, computed from the criterion levels; null when what the pitch says could not be rated
  pitch_score: number | null;
  subscores: Subscores;
  // Every level is given in code, from the signal and from the statements Gemma named for each expected topic
  criteria: Criterion[];
  // Empty when Gemma's reply to the checklist could not be used
  checklist: ChecklistItem[];
  insights: string[];
  feedback: { at_s: number | null; text: string }[];
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
  // How far down the slide the largest text sits: 0 is the top edge, 100 the bottom
  largest_text_depth_pct: number | null;
  // The largest text in the top of the slide; null when there is none there
  title_text_pct: number | null;
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
  // A small JPEG of the page, as a data URL
  thumbnail?: string;
  // null for a page without a text layer
  measurements: SlideMeasurements | null;
  // null when Gemma's reply did not parse; raw holds the reply then
  observations: SlideObservation | null;
  raw?: string;
};

export type DeckSummary = {
  // 0-100 in steps of 5, computed from the criterion levels; null when what the deck says could not be rated
  slide_score: number | null;
  subscores: Subscores;
  // Every level is given in code, from the file and from the lines Gemma named for each expected topic
  criteria: Criterion[];
  // Empty when Gemma's reply to the checklist could not be used
  checklist: ChecklistItem[];
  insights: string[];
  feedback: { slide: number | null; text: string }[];
};

export type DeckAnalysis = {
  model: string;
  page_count: number;
  pages_analyzed: number;
  text_layer: boolean;
  measurements: { words_median: number; words_max: number; smallest_text_pct: number; fonts: string[] } | null;
  slides: Slide[];
  summary: DeckSummary;
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

// Upload progress is measured in the browser; analysis progress comes from the service.
export type ProgressStage = AnalysisStage | "uploading" | "preparing";

export type AnalysisEvent<Result> =
  | { type: "progress"; stage: AnalysisStage; progress: number }
  | { type: "result"; data: Result }
  | { type: "error"; message: string };
