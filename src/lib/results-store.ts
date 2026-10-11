import { useSyncExternalStore } from "react";

import { type Alignment, type AudioAnalysis, type DeckAnalysis, RUBRIC_VERSION } from "@/lib/analysis";

export type Results = {
  pitch: AudioAnalysis | null;
  slides: DeckAnalysis | null;
  // Missing until a combined check has run; null when it ran and the two could not be compared
  alignment?: Alignment | null;
  // The saved example from public/sample-check.json, not an analysis of the visitor's files
  sample?: boolean;
};

// The results outlive a reload of the tab, because a full check can take many minutes. They live in
// sessionStorage, so they go when the tab closes and never leave the browser. The files do not survive.
const STORAGE_KEY = "pitchcheck-results";
const EMPTY: Results = { pitch: null, slides: null };

let current: Results | undefined;
const listeners = new Set<() => void>();

function read(): Results {
  try {
    const saved: Results | null = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || !(saved.pitch || saved.slides)) return EMPTY;
    // Results rated by another rubric have another shape: a tab that was open across an update starts empty
    const current = [saved.pitch, saved.slides].every((result) => !result || result.setup?.rubric === RUBRIC_VERSION);
    return current ? saved : EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showResults(next: Results) {
  current = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the results stay on the page until it is reloaded
  }
  listeners.forEach((listener) => listener());
}

// Empty on the server and for the first client render, then whatever the tab last showed
export function useResults() {
  return useSyncExternalStore(
    subscribe,
    () => (current ??= read()),
    () => EMPTY,
  );
}
