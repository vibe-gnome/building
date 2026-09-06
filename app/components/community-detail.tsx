import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import type { ShowcaseEntry } from "../lib/showcases";
import type { ToolEntry } from "../lib/tools";
import { ViewCount } from "./view-count";

type Category = "apps" | "skills";

function normalizeEntry(entry: ShowcaseEntry | ToolEntry | null) {
  if (!entry) return null;
  return "summary" in entry
    ? { ...entry, description: entry.summary, bestFor: undefined }
    : { ...entry, submittedBy: undefined, tags: [] };
}

export function communityDetailMeta(
  data: ShowcaseEntry | ToolEntry | null | undefined,
) {
  const entry = normalizeEntry(data ?? null);
  return [
    { title: `${entry?.name ?? "Page not found"} | Vibe GNOME` },
    ...(entry
      ? [{ name: "description", content: entry.description }]
      : [{ name: "robots", content: "noindex" }]),
  ];
}

export function CommunityDetail({
  category,
  data,
}: {
  category: Category;
  data: ShowcaseEntry | ToolEntry | null;
}) {
  const entry = normalizeEntry(data);
  if (!entry) {
    return (
      <main id="main-content" className="page-shell error-page" tabIndex={-1}>
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>This listing may have moved or been removed.</p>
        <Link className="button primary" to={`/${category}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Browse {category}
        </Link>
      </main>
    );
  }
  return (
    <main id="main-content" className="page-shell detail-page" tabIndex={-1}>
      <Link className="back-link" to={`/${category}`}>
        <ArrowLeft size={16} aria-hidden="true" /> All {category}
      </Link>
      <header className="detail-heading">
        <div>
          <p className="eyebrow">
            {category === "apps" ? "Community app" : "Agent skill"}
          </p>
          <h1>{entry.name}</h1>
          {entry.submittedBy ? <p>by {entry.submittedBy}</p> : null}
        </div>
      </header>
      <div className="detail-layout">
        <div className="detail-content">
          <p className="detail-summary">{entry.description}</p>
          {entry.bestFor ? <p>Best for: {entry.bestFor}</p> : null}
          {entry.tags.length > 0 ? (
            <div className="tag-list">
              {entry.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
        <aside
          className="detail-sidebar"
          aria-label={
            category === "apps" ? "App information" : "Skill information"
          }
        >
          <a
            className="button primary"
            href={entry.href}
            target="_blank"
            rel="noreferrer"
          >
            {category === "apps" ? "Visit project" : "Open skill"}{" "}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <dl>
            <ViewCount category={category} slug={entry.id} />
          </dl>
        </aside>
      </div>
    </main>
  );
}
