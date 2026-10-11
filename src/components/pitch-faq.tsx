import { Plus } from "lucide-react";

const questions = [
  { question: "What can I upload?", answer: "For delivery feedback, upload a video such as MP4, MOV or WebM, or an audio recording such as MP3, WAV or M4A. For your deck, choose a PDF presentation up to 25 MB." },
  { question: "What does PitchCheck actually score?", answer: "Gemma evaluates your pitch delivery from the audio itself, with signal measurements as supporting evidence. The score and feedback describe how you present; they do not rate your business idea or investment potential." },
  { question: "Can I check my slide deck yet?", answer: "You can select, replace and preview your PDF now. Slide analysis, slide scores and checking the pitch against the deck are coming in a later step. Your deck stays in this browser and is not submitted for analysis yet." },
  { question: "Is my pitch deck private?", answer: "Yes. Your pitch and deck never leave the competition organizer's server. Gemma runs there too, so your files are never sent to external AI providers. PDF preview currently stays in your browser." },
];

export function PitchFaq() {
  return (
    <section id="faq" className="faq-section site-container" aria-labelledby="faq-title">
      <div className="faq-heading">
        <p className="eyebrow">Good to know</p>
        <h2 id="faq-title" className="section-title">A few things<br />worth knowing.</h2>
        <p>Your pitch deserves a little clarity.<br />So does the way we check it.</p>
      </div>
      <div>
        {questions.map(({ question, answer }) => (
          <details className="faq-item" key={question}>
            <summary>{question}<Plus aria-hidden="true" /></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
