import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Guides } from "../components/guide-list";

export function meta() {
  return [
    { title: "Guides: Docs and Skills | Vibe GNOME" },
    {
      name: "description",
      content:
        "Articles and agent skills for learning to build GNOME apps and extensions with AI.",
    },
  ];
}

export default function GuidesPage() {
  return (
    <main id="main-content" className="page-shell guides-page" tabIndex={-1}>
      <Link className="guides-back" to="/#guides">
        <ArrowLeft size={16} aria-hidden="true" /> Back to home
      </Link>
      <div className="guides-directory">
        <header className="section-heading">
          <p className="kicker">Guides</p>
          <h1>
            Learn to <span className="heading-accent">vibe code</span> for
            GNOME.
          </h1>
          <p>
            Explore docs and reusable agent skills for building GNOME apps and
            extensions with AI.
          </p>
        </header>
        <Guides />
      </div>
    </main>
  );
}
