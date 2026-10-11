import { HowItWorks } from "@/components/how-it-works";
import { PitchFaq } from "@/components/pitch-faq";
import { PitchHero } from "@/components/pitch-hero";
import { PitchWorkspace } from "@/components/pitch-workspace";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <PitchHero />
        <section className="workspace-section site-container" id="workspace" aria-labelledby="workspace-title">
          <div className="section-intro">
            <div><p className="eyebrow">Your practice space</p><h2 id="workspace-title" className="section-title">Good pitches start here.</h2></div>
            <p className="section-description">Bring the recording. Bring the slides.<br />Take the next step toward a clearer pitch.</p>
          </div>
          <PitchWorkspace />
          <p className="workspace-note"><ShieldCheck aria-hidden="true" /> Scores rate your delivery and slides, never your business idea.</p>
        </section>
        <HowItWorks />
        <PitchFaq />
      </main>
      <SiteFooter />
    </div>
  );
}
