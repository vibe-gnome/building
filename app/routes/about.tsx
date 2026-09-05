import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { AppearanceControl } from "../components/appearance-control";
import { SiteFooter } from "../components/site-footer";

export function meta() {
  return [
    { title: "About Vibe GNOME" },
    {
      name: "description",
      content:
        "We love GNOME. Vibe GNOME brings together community projects and tools to make vibe coding for GNOME better.",
    },
  ];
}

export default function About() {
  return (
    <div className="about-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link aria-label="Vibe GNOME home" className="brand" to="/">
            <svg
              className="brand-logo"
              focusable="false"
              role="img"
              viewBox="0 0 1024 1024"
            >
              <title>Vibe GNOME home</title>
              <use href="/logo.svg#paw-print" />
            </svg>
          </Link>
          <div className="header-actions">
            <Link
              aria-label="Home"
              className="header-button"
              title="Home"
              to="/"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              <span>Home</span>
            </Link>
            <AppearanceControl />
          </div>
        </div>
      </header>

      <main className="about-main page-shell" id="main-content">
        <article className="about-copy">
          <h1>About Vibe GNOME</h1>
          <p className="about-lead">We love GNOME.</p>
          <p>We love the desktop, the apps, and the community behind them.</p>

          <section aria-labelledby="sharing-title">
            <h2 id="sharing-title">A home for GNOME vibe-coding projects</h2>
            <p>
              We want a place to collect and share projects made through vibe
              coding for GNOME. From <Link to="/apps">apps</Link> to{" "}
              <Link to="/extensions">Shell extensions</Link>, small experiments
              and everyday improvements deserve a place to be discovered.
            </p>
          </section>

          <section aria-labelledby="building-title">
            <h2 id="building-title">More AI-friendly</h2>
            <p>
              We want to make GNOME more AI-friendly. By sharing{" "}
              <Link to="/skills">agent skills</Link> and practical knowledge, we
              aim to help people use AI to get more from their GNOME desktop,
              automate everyday tasks, and build better GNOME software.
            </p>
            <p>
              Whether you are sharing something you made, improving a tool, or
              just getting started, you are welcome here.
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
