import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VerdictChecker } from "@/components/verdict-checker";

export const metadata: Metadata = {
  title: "Check a verdict · pitchcheck",
  description: "Check that a PitchCheck verdict was made for the files a team shows",
};

export default function VerifyPage() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <section className="workspace-section site-container" aria-labelledby="verify-title">
          <div className="section-intro">
            <div>
              <p className="eyebrow">For organizers</p>
              <h1 id="verify-title" className="section-title">Check a verdict.</h1>
            </div>
            <p className="section-description">
              A team sent you a verdict and now shows its recording and deck. See whether they are the
              files that were scored.
            </p>
          </div>
          <VerdictChecker />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
