import { Plus } from "lucide-react";
import {
  type ShowcaseCategory,
  showcaseCollections,
  showcaseSubmissionUrl,
} from "../lib/showcases";

export function ShowcasePage({ category }: { category: ShowcaseCategory }) {
  const collection = showcaseCollections[category];

  return (
    <main
      id="main-content"
      className="page-shell marketplace directory-page"
      tabIndex={-1}
    >
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Community showcase</p>
          <h1>
            Vibe GNOME{" "}
            <span>{category === "apps" ? "Apps" : "Extensions"}</span>
          </h1>
          <p>{collection.description}</p>
        </div>
        <a
          className="button primary submit-button"
          href={showcaseSubmissionUrl(category)}
          target="_blank"
          rel="noreferrer"
        >
          <Plus size={17} aria-hidden="true" />
          Submit {category === "apps" ? "app" : "extension"}
        </a>
      </div>
      <section
        className="directory-section"
        aria-labelledby="showcase-submissions-title"
      >
        <header className="directory-section-heading">
          <h2 id="showcase-submissions-title">Community submissions</h2>
          <span>{collection.entries.length} submissions</span>
        </header>
        {collection.entries.length === 0 ? (
          <p className="empty-state directory-empty">No submissions yet.</p>
        ) : (
          <div className="community-entry-grid">
            {collection.entries.map((entry) => (
              <article
                className="extension-card community-entry"
                key={entry.name}
              >
                <span className="eyebrow">{entry.submittedBy}</span>
                <h2>{entry.name}</h2>
                <p className="card-summary">{entry.summary}</p>
                <div className="tag-list">
                  {entry.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
