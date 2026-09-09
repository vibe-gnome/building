import { ArrowUpRight, MessageCircle } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { AppearanceControl } from "../components/appearance-control";
import { HomeGuides } from "../components/guide-list";
import { IdeaFootprints } from "../components/idea-footprints";
import { ParticleTypography } from "../components/particle-typography";
import { SiteFooter } from "../components/site-footer";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Vibe GNOME — Build apps that belong on your desktop" },
    {
      name: "description",
      content:
        "A practical guide to vibe coding native GNOME apps and Shell extensions.",
    },
    { property: "og:title", content: "Vibe GNOME" },
    {
      property: "og:description",
      content: "Make GNOME apps and extensions with a capable coding agent.",
    },
    { property: "og:image", content: "/logo.svg" },
  ];
}

const resources = [
  {
    title: "GNOME Developer",
    description: "Platform overview, tutorials, APIs, and tooling.",
    href: "https://developer.gnome.org/",
  },
  {
    title: "GNOME Project Handbook",
    description: "Contributing to GNOME, its teams, and development processes.",
    href: "https://handbook.gnome.org/",
  },
  {
    title: "Human Interface Guidelines",
    description: "Design patterns that make an app feel at home on GNOME.",
    href: "https://developer.gnome.org/hig/",
  },
  {
    title: "GJS Extension Guide",
    description: "Create, debug, and upgrade GNOME Shell extensions.",
    href: "https://gjs.guide/extensions/",
  },
  {
    title: "Workbench",
    description: "Prototype GTK and Libadwaita interfaces interactively.",
    href: "https://apps.gnome.org/Workbench/",
  },
  {
    title: "Flatpak documentation",
    description: "Package and distribute a sandboxed desktop app.",
    href: "https://docs.flatpak.org/",
  },
] as const;

const showcaseLinks = [
  {
    category: "apps",
    description: "Native desktop tools shared by community builders.",
    href: "/apps",
    title: "Apps",
  },
  {
    category: "extensions",
    description: "Focused ways to reshape and extend GNOME Shell.",
    href: "/extensions",
    title: "Extensions",
  },
  {
    category: "skills",
    description: "Reusable agent guidance for reliable GNOME builds.",
    href: "/skills",
    title: "Skills",
  },
] as const;

const footprints = Array.from({ length: 22 }, (_, index) => ({
  delay: `${index * 85}ms`,
  id: `footprint-${index + 1}`,
  offset: `${index % 2 === 0 ? -8 : 8}px`,
  rotation: `${90 + (index % 2 === 0 ? -5 : 5)}deg`,
  size: `${index % 2 === 0 ? 25 : 22}px`,
}));

type FootprintStyle = CSSProperties & {
  "--footprint-delay": string;
  "--footprint-offset": string;
  "--footprint-rotation": string;
  "--footprint-size": string;
};

function FootprintTrail() {
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return;

    const footprints = trail.querySelectorAll(".footprint");

    const revealAll = () => {
      for (const footprint of footprints) footprint.classList.add("is-visible");
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        revealAll();
        observer.disconnect();
      },
      { rootMargin: "0px 0px -6%", threshold: 0.15 },
    );

    observer.observe(trail);
    return () => observer.disconnect();
  }, []);

  return (
    <div aria-hidden="true" className="footprint-run page-shell" ref={trailRef}>
      {footprints.map((footprint) => {
        const style: FootprintStyle = {
          "--footprint-delay": footprint.delay,
          "--footprint-offset": footprint.offset,
          "--footprint-rotation": footprint.rotation,
          "--footprint-size": footprint.size,
        };

        return (
          <svg
            className="footprint"
            focusable="false"
            key={footprint.id}
            style={style}
            viewBox="0 0 1024 1024"
          >
            <title>Decorative cat paw</title>
            <use href="/logo.svg#paw-print" />
          </svg>
        );
      })}
    </div>
  );
}

function LogoMark() {
  return (
    <svg
      aria-label="Vibe GNOME home"
      className="brand-logo"
      focusable="false"
      role="img"
      viewBox="0 0 1024 1024"
    >
      <title>Vibe GNOME home</title>
      <use href="/logo.svg#paw-print" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a aria-label="Vibe GNOME home" className="brand" href="#top">
            <LogoMark />
          </a>
          <div className="header-actions">
            <a
              className="header-button"
              href="https://www.reddit.com/r/vibe_gnome/"
              rel="noreferrer"
              target="_blank"
            >
              <MessageCircle aria-hidden="true" size={17} />
              <span>r/vibe_gnome</span>
            </a>
            <AppearanceControl />
            <a
              aria-label="Vibe GNOME on GitHub"
              className="header-button header-icon-button"
              href="https://github.com/vibe-gnome"
              rel="noreferrer"
              target="_blank"
              title="Vibe GNOME on GitHub"
            >
              <svg
                role="img"
                width={19}
                height={19}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <title>GitHub</title>
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <ParticleTypography
            text={"Vibe coding for GNOME.\nWhy not?"}
            mobileText={"Vibe coding\nfor GNOME.\nWhy not?"}
            fontSize={160}
            particleDensity={4}
          />
          <IdeaFootprints />
        </section>

        <section
          className="content-section showcase-section page-shell"
          id="showcases"
        >
          <div className="section-heading">
            <p className="kicker">Community showcase</p>
            <h2>
              See what people are{" "}
              <span className="heading-accent">building</span>.
            </h2>
          </div>
          <div className="showcase-link-list">
            {showcaseLinks.map((item) => (
              <a data-category={item.category} href={item.href} key={item.href}>
                <img
                  alt=""
                  className="showcase-card-icon"
                  height={112}
                  src={`/icons/showcase/${item.category}.svg`}
                  width={112}
                />
                <div className="showcase-card-copy">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <ArrowUpRight aria-hidden="true" size={20} />
              </a>
            ))}
          </div>
        </section>

        <HomeGuides />

        <section className="content-section page-shell" id="resources">
          <div className="section-heading">
            <p className="kicker">Trusted resources</p>
            <h2>
              Keep the <span className="heading-accent">official</span> docs
              close.
            </h2>
          </div>
          <div className="resource-list">
            {resources.map((resource) => (
              <a
                href={resource.href}
                key={resource.title}
                rel="noreferrer"
                target="_blank"
              >
                <span>
                  <strong>{resource.title}</strong>
                  <small>{resource.description}</small>
                </span>
                <ArrowUpRight aria-hidden="true" size={17} />
              </a>
            ))}
          </div>
        </section>
        <FootprintTrail />
      </main>

      <SiteFooter />
    </>
  );
}
