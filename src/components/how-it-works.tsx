import { ArrowRight, ArrowUpRight, AudioLines, FileText, RefreshCw, Sparkles, Video } from "lucide-react";

const waveform = [18, 30, 22, 44, 60, 38, 72, 48, 86, 58, 36, 68, 92, 52, 76, 40, 60, 32, 46, 24, 36];

function UploadPreview() {
  return (
    <div className="how-upload-preview">
      <div className="how-file how-file-deck">
        <span className="how-file-icon"><FileText /></span>
        <span><strong>Pitch deck</strong><small>PDF presentation</small></span>
      </div>
      <div className="how-file how-file-recording">
        <span className="how-file-icon"><Video /></span>
        <span><strong>Your pitch</strong><small>Audio or video</small></span>
        <span className="how-file-dot" />
      </div>
    </div>
  );
}

function ListeningPreview() {
  return (
    <div className="how-listening-preview">
      <span className="how-listening-label"><Sparkles />Gemma is listening</span>
      <div className="how-waveform">
        {waveform.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
      </div>
      <span className="how-listening-caption">Every word. Every pause.</span>
    </div>
  );
}

function PracticePreview() {
  return (
    <div className="how-practice-preview">
      <span className="how-practice-orbit" />
      <span className="how-practice-center"><RefreshCw /></span>
      <span className="how-practice-chip how-practice-feedback"><Sparkles />Feedback</span>
      <span className="how-practice-chip how-practice-take"><AudioLines />Next take</span>
    </div>
  );
}

const steps = [
  { number: "01", label: "Upload", variant: "upload", Preview: UploadPreview, title: "Bring your pitch.", description: "Upload your recording and the PDF of your deck. Check either one, or both together." },
  { number: "02", label: "Discover", variant: "listen", Preview: ListeningPreview, title: "Find your focus.", description: "Get a delivery score, a slide score and feedback tied to moments in your pitch and to slide numbers." },
  { number: "03", label: "Refine", variant: "practice", Preview: PracticePreview, title: "Come back stronger.", description: "See which slides you never explained. Fix them, record a new take and check again." },
];

export function HowItWorks() {
  return (
    <section className="how-section site-container" id="how-it-works" aria-labelledby="how-title">
      <div className="how-panel">
        <div className="how-heading">
          <div>
            <p className="eyebrow">A little practice goes a long way</p>
            <h2 id="how-title" className="section-title">Small steps.<br /><span>Stronger pitches.</span></h2>
          </div>
          <a href="#pitch-video" className="how-start-link">Start your first check <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <ol className="how-steps" role="list">
          {steps.map(({ number, label, variant, Preview, title, description }, index) => (
            <li className={`how-step how-step-${variant}`} key={number}>
              <div className="how-step-meta"><span className="how-step-label">{label}</span><span className="how-step-number">{number}</span></div>
              <div className="how-step-art" aria-hidden="true"><Preview /></div>
              <h3>{title}</h3>
              <p className="how-step-description">{description}</p>
              {index < steps.length - 1 && <span className="how-step-connector"><ArrowRight aria-hidden="true" /></span>}
            </li>
          ))}
        </ol>
        <p className="how-repeat-note"><RefreshCw aria-hidden="true" />A simple loop. A little more confidence.</p>
      </div>
    </section>
  );
}
