"use client";

import { useState } from "react";
import { ArrowUpRight, AudioLines, PanelsTopLeft } from "lucide-react";

export function CombinedPitchCheck() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="combined-check">
      <button
        type="button"
        className="combined-check-button"
        aria-expanded={expanded}
        aria-controls="combined-check-details"
        aria-describedby="combined-check-description combined-check-availability"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="combined-check-icons" aria-hidden="true">
          <span><AudioLines /></span>
          <span><PanelsTopLeft /></span>
        </span>
        <span>Check pitch + deck</span>
        <span className="combined-check-arrow"><ArrowUpRight aria-hidden="true" /></span>
      </button>
      <p id="combined-check-description" className="combined-check-description">
        Two scores. See how your pitch follows your slides.
      </p>
      <p id="combined-check-availability" className="combined-check-availability">
        Coming soon <span aria-hidden="true">·</span> Powered by Gemma
      </p>
      <div id="combined-check-details" className="combined-check-details" hidden={!expanded}>
        <p>
          Gemma will score your delivery and your deck separately, then compare
          what you say with what your slides show. Get feedback on missed topics
          and contradictions, with room to add your own explanation.
        </p>
        <p className="combined-check-details-note">
          The combined check is coming soon. You can already analyze your recording
          and preview your PDF above.
        </p>
      </div>
    </div>
  );
}
