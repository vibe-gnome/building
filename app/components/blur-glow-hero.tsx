import { useEffect, useRef, useState } from "react";
import { BlurGlow } from "../lib/blur-glow/engine";

export function BlurGlowHero() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [presentation, setPresentation] = useState<
    "pending" | "enhanced" | "fallback"
  >("pending");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      setPresentation("fallback");
      return;
    }

    let glow: BlurGlow;
    try {
      glow = new BlurGlow(host);
    } catch {
      setPresentation("fallback");
      return;
    }
    if (!glow.isReady()) {
      glow.destroy();
      setPresentation("fallback");
      return;
    }

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let visible = true;
    let disposed = false;

    const syncPlayback = () => {
      if (motionPreference.matches) {
        glow.stop();
        glow.renderStill(true);
      } else if (visible) {
        glow.start();
      } else {
        glow.stop();
      }
    };

    glow.renderStill(true);
    setPresentation("enhanced");

    const resizeObserver = new ResizeObserver(() => glow.onResize());
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        syncPlayback();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(host);

    motionPreference.addEventListener("change", syncPlayback);
    syncPlayback();

    void document.fonts.ready.then(() => {
      if (!disposed) glow.refreshFont();
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionPreference.removeEventListener("change", syncPlayback);
      glow.destroy();
    };
  }, []);

  return (
    <div className="hero-copy" data-webgl={presentation}>
      <h1 className="hero-heading">
        Vibe coding for GNOME.
        <span>Why not?</span>
      </h1>
      <div aria-hidden="true" className="blur-glow-host" ref={hostRef} />
    </div>
  );
}
