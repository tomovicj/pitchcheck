import { Plus } from "lucide-react";

const questions = [
  { question: "What can I upload?", answer: "For delivery feedback, upload a video such as MP4, MOV or WebM, or an audio recording such as MP3, WAV or M4A. For your deck, choose a PDF presentation up to 25 MB." },
  { question: "What does PitchCheck actually score?", answer: "Two things, separately. Gemma listens to your delivery in the audio itself and reads every slide of your deck. Each score comes from a fixed rubric with levels from 0 to 4, shown next to the measurement or the observation behind it. The scores describe how you present; they do not rate your business idea, its investment potential or your emotions." },
  { question: "How does the deck check work?", answer: "Gemma reads each slide for its title, its point and the topics it covers. Text size, word count, fonts and contrast are measured from the PDF itself, so a slide with tiny text or faint text is named by its number. Export your deck as a PDF with selectable text to get those measurements." },
  { question: "Do I have to read my slides out loud?", answer: "No. The combined check compares the key points of your slides with what you say. Summarising a slide or adding explanation is fine. It lists the deck points you never explained and the places where the talk and a slide disagree, and it is not part of either score." },
  { question: "Where do my pitch and my deck get processed?", answer: "They go to the analysis service this app is connected to, and nowhere else. When you run the app and the service on your own machine, your recording and your deck are analyzed there. An event can also run the service on its own server; then your files are sent to it. Model weights are downloaded from Hugging Face on the first startup." },
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
