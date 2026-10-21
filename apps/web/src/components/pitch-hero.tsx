import { ArrowUpRight, AudioLines, PanelsTopLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { ProductShowcase } from "@/components/product-showcase";

export function PitchHero() {
  return (
    <section className="pitch-hero site-container" aria-labelledby="hero-title">
      <p className="eyebrow">A little practice. A better pitch.</p>
      <h1 id="hero-title" className="hero-title"><span>Your next pitch.</span><span>Your best pitch.</span></h1>
      <p className="hero-description">Find your rhythm. Sharpen your slides. Walk in ready.</p>
      <div className="hero-actions">
        <a href="#pitch-video" className="pill-button">Check your pitch <ArrowUpRight aria-hidden="true" /></a>
        <a href="#pitch-deck" className="pill-button pill-secondary">Explore deck checker <ArrowUpRight aria-hidden="true" /></a>
      </div>
      <div className="hero-privacy">
        <span className="hero-privacy-label"><ShieldCheck aria-hidden="true" />Privacy first</span>
        <p>Your files stay on the organizer&apos;s server.</p>
      </div>
      <div className="hero-showcase"><ProductShowcase /></div>
      <div className="capability-strip">
        <div className="capability-item"><AudioLines aria-hidden="true" /><div><strong>Make yourself heard.</strong><p>Feedback on your pitch delivery.</p></div></div>
        <div className="capability-item"><PanelsTopLeft aria-hidden="true" /><div><strong>Let your slides tell the story.</strong><p>A score for your deck, with feedback by slide.</p></div></div>
        <div className="capability-item"><RefreshCw aria-hidden="true" /><div><strong>Practice with a purpose.</strong><p>Take feedback into your next recording.</p></div></div>
      </div>
    </section>
  );
}
