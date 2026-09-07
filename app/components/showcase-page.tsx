import { Plus } from "lucide-react";
import { Link } from "react-router";
import { listingPath } from "../lib/listing-links";
import {
  type ShowcaseCategory,
  type ShowcaseEntry,
  showcaseCollections,
  showcaseSubmissionUrl,
} from "../lib/showcases";

export function ShowcasePage({
  category,
  entries,
}: {
  category: ShowcaseCategory;
  entries: readonly ShowcaseEntry[];
}) {
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
          <span>{entries.length} submissions</span>
        </header>
        {entries.length === 0 ? (
          <p className="empty-state directory-empty">No submissions yet.</p>
        ) : (
          <div className="community-entry-grid">
            {entries.map((entry) => (
              <article
                className="extension-card community-entry"
                key={entry.id}
              >
                <span className="eyebrow">{entry.submittedBy}</span>
                <h2>
                  <Link to={listingPath(category, entry)}>{entry.name}</Link>
                </h2>
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
