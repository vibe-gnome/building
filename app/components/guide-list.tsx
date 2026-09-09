import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { type GuideEntry, guideArticles, skillGuides } from "../lib/guides";
import { type GuideSkillsState, useGuideSkills } from "../lib/use-guide-skills";

function GuideRow({ entry }: { entry: GuideEntry }) {
  const content = (
    <>
      <span className="guide-copy">
        <span className="guide-meta">
          {entry.kind}
          {entry.source ? ` · ${entry.source}` : ""}
        </span>
        <strong>{entry.title}</strong>
        <small>{entry.description}</small>
      </span>
      {entry.kind === "Doc" ? (
        <ArrowUpRight aria-hidden="true" size={17} />
      ) : (
        <ArrowRight aria-hidden="true" size={17} />
      )}
    </>
  );

  return (
    <li>
      {entry.kind === "Doc" ? (
        <a
          className="guide-link"
          href={entry.href}
          target="_blank"
          rel="noreferrer"
        >
          {content}
        </a>
      ) : (
        <Link className="guide-link" to={entry.href}>
          {content}
        </Link>
      )}
    </li>
  );
}

export function GuideList({
  state,
  retry,
  preview = false,
}: {
  state: GuideSkillsState;
  retry: () => void;
  preview?: boolean;
}) {
  const skills = state.status === "ready" ? skillGuides(state.entries) : [];
  const articles = preview ? guideArticles.slice(0, 1) : guideArticles;
  const visibleSkills = preview ? skills.slice(0, 3) : skills;

  return (
    <ul className="guide-list" aria-label="Docs and skills">
      {articles.map((entry) => (
        <GuideRow key={`doc-${entry.id}`} entry={entry} />
      ))}
      {visibleSkills.map((entry) => (
        <GuideRow key={`skill-${entry.id}`} entry={entry} />
      ))}
      {state.status === "loading" && (
        <li className="guide-status">
          <p role="status">Loading skills…</p>
        </li>
      )}
      {state.status === "error" && (
        <li className="guide-status">
          <p role="status">Skills are temporarily unavailable.</p>
          <button className="guide-retry" type="button" onClick={retry}>
            Try again
          </button>
        </li>
      )}
      {state.status === "ready" && skills.length === 0 && (
        <li className="guide-status">
          <p>
            No skills published yet. Explore the article above to get started.
          </p>
        </li>
      )}
      {preview && (
        <li>
          <Link
            className="guide-link guide-see-all"
            to="/guides"
            aria-label="See all docs and skills"
          >
            <strong>See all</strong>
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </li>
      )}
    </ul>
  );
}

export function Guides({ preview = false }: { preview?: boolean }) {
  const { state, retry } = useGuideSkills();
  return <GuideList state={state} retry={retry} preview={preview} />;
}

export function HomeGuides() {
  return (
    <section
      className="content-section page-shell"
      id="guides"
      aria-labelledby="guides-heading"
    >
      <div className="section-heading">
        <p className="kicker">Guides</p>
        <h2 id="guides-heading">
          Resources for <span className="heading-accent">vibe coding</span> on
          GNOME.
        </h2>
        <p>Docs and skills for your next app or extension.</p>
      </div>
      <Guides preview />
    </section>
  );
}
