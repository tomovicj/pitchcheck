"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { label: "Pitch checker", href: "#pitch-video" },
  { label: "Deck checker", href: "#pitch-deck" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="site-header site-container">
      <a href="#top" aria-label="PitchCheck home">
        <Image src="/brand/pitchcheck.png" alt="PitchCheck" width={1210} height={340} sizes="(max-width: 640px) 138px, 164px" className="brand-image" loading="eager" />
      </a>
      <nav aria-label="Main navigation" className="site-nav">
        {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
      </nav>
      <div className="header-actions">
        <a className="pill-button header-cta" href="#pitch-video">Check your pitch <ArrowUpRight aria-hidden="true" /></a>
        <button type="button" className="mobile-menu-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
          {links.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
        </nav>
      )}
    </header>
  );
}
