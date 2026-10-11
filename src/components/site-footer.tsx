import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-content">
        <div>
          <a href="#top" aria-label="PitchCheck home"><Image src="/brand/pitchcheck.png" alt="PitchCheck" width={1210} height={340} sizes="136px" className="brand-image" /></a>
          <p className="footer-tagline">Practice with purpose.</p>
        </div>
        <div className="footer-right"><span>Built with Gemma</span><a href="#pitch-video" className="footer-link">Back to your pitch <ArrowUpRight aria-hidden="true" /></a></div>
      </div>
    </footer>
  );
}
