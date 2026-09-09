import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Guides } from "../components/guide-list";

export function meta() {
  return [
    { title: "Guides: Docs and Skills | Vibe GNOME" },
    {
      name: "description",
      content:
        "Articles and agent skills to help you vibe code GNOME apps and extensions.",
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
            Resources for <span className="heading-accent">vibe coding</span> on
            GNOME.
          </h1>
          <p>
            Helpful docs and reusable agent skills for your next GNOME app or
            extension.
          </p>
        </header>
        <Guides />
      </div>
    </main>
  );
}
