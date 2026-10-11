import { AudioLines, RefreshCw, Video } from "lucide-react";

const steps = [
  { number: "01", Icon: Video, title: "Bring your pitch", description: "Drop in a video or audio recording. You can also add a PDF deck to preview your slides alongside your practice." },
  { number: "02", Icon: AudioLines, title: "Listen a little closer", description: "Gemma listens to the recording and returns a delivery score, insights and feedback tied to moments in your pitch." },
  { number: "03", Icon: RefreshCw, title: "Go again, with clarity", description: "Turn feedback into a focused practice session. Record another take, check your delivery and keep moving forward." },
];

export function HowItWorks() {
  return (
    <section className="how-section site-container" id="how-it-works" aria-labelledby="how-title">
      <p className="eyebrow">From practice to presentation</p>
      <h2 id="how-title" className="section-title">Small steps. Stronger pitches.</h2>
      <div className="steps-grid">
        {steps.map(({ number, Icon, title, description }) => (
          <div className="step" key={number}>
            <span className="step-icon"><Icon aria-hidden="true" /></span>
            <span className="step-number">{number} /</span>
            <h3>{title}</h3><p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
