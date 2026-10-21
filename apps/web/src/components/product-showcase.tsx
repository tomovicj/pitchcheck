import { AudioLines, PanelsTopLeft, Play, Sparkles } from "lucide-react";

import "./product-showcase.css";

const waveformHeights = [
  16, 24, 34, 22, 45, 57, 40, 66, 52, 78, 60, 42, 54, 70, 88, 64, 46, 62, 76,
  52, 36, 58, 72, 48, 34, 44, 26, 38, 22, 30, 16,
];

export function ProductShowcase() {
  return (
    <div
      className="ps-showcase"
      role="img"
      aria-label="Conceptual PitchCheck illustration: pitch delivery and a PDF slide deck, brought together into one stronger pitch."
    >
      <div className="ps-artwork" aria-hidden="true">
        <div className="ps-orb ps-orb-left" />
        <div className="ps-orb ps-orb-right" />
        <div className="ps-orbit" />

        <div className="ps-topline">
          <span className="ps-eyebrow">Your pitch, in focus</span>
          <span className="ps-gemma-badge">
            <Sparkles aria-hidden="true" size={13} strokeWidth={1.6} />
            Powered by Gemma
          </span>
        </div>

        <div className="ps-card ps-delivery-card">
          <div className="ps-card-heading">
            <span className="ps-card-title">Pitch delivery</span>
            <span className="ps-card-format">Audio + video</span>
          </div>
          <div className="ps-recording">
            <div className="ps-waveform">
              {waveformHeights.map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="ps-recording-footer">
              <span className="ps-play-symbol">
                <Play aria-hidden="true" size={13} fill="currentColor" />
              </span>
              <span className="ps-recording-track" />
              <AudioLines aria-hidden="true" size={14} strokeWidth={1.5} />
            </div>
          </div>
          <p className="ps-card-caption">Make every word count.</p>
        </div>

        <div className="ps-connector">
          <span className="ps-connector-icon">
            <Sparkles aria-hidden="true" size={32} strokeWidth={1.1} />
          </span>
          <span className="ps-connector-label">One stronger pitch</span>
        </div>

        <div className="ps-card ps-deck-card">
          <div className="ps-card-heading">
            <span className="ps-card-title">Pitch deck</span>
            <span className="ps-card-format">PDF</span>
          </div>
          <div className="ps-slide">
            <span className="ps-slide-eyebrow">The next chapter</span>
            <p className="ps-slide-title">A clear story.<br />A confident pitch.</p>
            <div className="ps-slide-chart">
              <span className="ps-chart-block ps-chart-block-one" />
              <span className="ps-chart-block ps-chart-block-two" />
              <span className="ps-chart-block ps-chart-block-three" />
              <span className="ps-chart-block ps-chart-block-four" />
            </div>
            <span className="ps-slide-page">01 / 08</span>
          </div>
          <div className="ps-deck-pages">
            <span className="ps-page-dot ps-page-dot-active" />
            <span className="ps-page-dot" />
            <span className="ps-page-dot" />
            <span className="ps-page-dot" />
          </div>
        </div>

        <span className="ps-bottom-pill ps-bottom-delivery">
          <AudioLines aria-hidden="true" size={14} strokeWidth={1.5} />
          Delivery
        </span>
        <span className="ps-bottom-pill ps-bottom-slides">
          <PanelsTopLeft aria-hidden="true" size={14} strokeWidth={1.5} />
          Slides
        </span>
      </div>
    </div>
  );
}
