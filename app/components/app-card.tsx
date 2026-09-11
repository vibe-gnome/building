import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { appRepositoryInfo } from "../lib/app-catalog";
import { listingPath } from "../lib/listing-links";
import type { ShowcaseEntry } from "../lib/showcases";
import { AppIcon } from "./app-icon";

export function AppCard({ entry }: { entry: ShowcaseEntry }) {
  const repository = appRepositoryInfo(entry.href);
  return (
    <article className="extension-card app-card">
      <div className="card-heading">
        <AppIcon src={entry.icon} />
        <div>
          <Link className="extension-title" to={listingPath("apps", entry)}>
            <h2>{entry.name}</h2>
          </Link>
          {repository.owner && (
            <span className="author">by {repository.owner}</span>
          )}
        </div>
      </div>
      <p className="card-summary">{entry.summary}</p>
      <div className="tag-list">
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <dl className="card-metadata">
        {entry.appId && (
          <div>
            <dt>App ID</dt>
            <dd>{entry.appId}</dd>
          </div>
        )}
        <div>
          <dt>Repository</dt>
          <dd>{repository.host}</dd>
        </div>
      </dl>
      <div className="card-actions">
        <a href={entry.href} target="_blank" rel="noreferrer">
          Source <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <Link to={listingPath("apps", entry)}>
          View app <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
