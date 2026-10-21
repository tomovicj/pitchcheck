import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-content">
        <div>
          <Link href="/#top" aria-label="PitchCheck home"><Image src="/brand/pitchcheck.png" alt="PitchCheck" width={1210} height={340} sizes="136px" className="brand-image" /></Link>
          <p className="footer-tagline">Privacy first.</p>
        </div>
        <div className="footer-right">
          <span>Built with Gemma</span>
          <Link href="/verify" className="footer-link">Check a verdict <ArrowUpRight aria-hidden="true" /></Link>
          <Link href="/#pitch-video" className="footer-link">Back to your pitch <ArrowUpRight aria-hidden="true" /></Link>
        </div>
      </div>
    </footer>
  );
}
