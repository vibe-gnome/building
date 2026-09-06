import { ArrowUpRight, Plus } from "lucide-react";
import { Link } from "react-router";
import {
  type ToolCategory,
  type ToolEntry,
  toolCollections,
  toolSubmissionUrl,
} from "../lib/tools";

function ToolList({ entries }: { entries: readonly ToolEntry[] }) {
  return (
    <div className="community-entry-grid">
      {entries.map((entry) => (
        <article className="extension-card community-entry" key={entry.id}>
          <span className="eyebrow">Community submission</span>
          <h2>
            <Link to={`/skills/${entry.id}`}>{entry.name}</Link>
          </h2>
          <p className="card-summary">{entry.description}</p>
          {entry.bestFor ? (
            <p className="best-for">Best for: {entry.bestFor}</p>
          ) : null}
          <div className="card-actions">
            <a
              aria-label={`Open ${entry.name}`}
              href={entry.href}
              rel="noreferrer"
              target="_blank"
            >
              Open <ArrowUpRight aria-hidden="true" size={15} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ToolPage({
  category,
  entries,
}: {
  category: ToolCategory;
  entries: readonly ToolEntry[];
}) {
  const collection = toolCollections[category];

  return (
    <main
      id="main-content"
      className="page-shell marketplace directory-page tool-page"
      tabIndex={-1}
    >
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Vibe Tools</p>
          <h1>
            Vibe GNOME <span>{collection.title}</span>
          </h1>
          <p>{collection.description}</p>
        </div>
        <a
          className="button primary submit-button"
          href={toolSubmissionUrl(category)}
          target="_blank"
          rel="noreferrer"
          title={`${collection.submitLabel} via GitHub issue`}
        >
          <Plus size={17} aria-hidden="true" />
          {collection.submitLabel}
        </a>
      </div>
      <section
        className="directory-section"
        aria-labelledby="submissions-title"
      >
        <header className="directory-section-heading">
          <h2 id="submissions-title">Community submissions</h2>
          <span>{entries.length} submissions</span>
        </header>
        {entries.length === 0 ? (
          <p className="empty-state directory-empty">No submissions yet.</p>
        ) : (
          <ToolList entries={entries} />
        )}
      </section>
    </main>
  );
}
