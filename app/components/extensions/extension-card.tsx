import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  defaultExtensionIcon,
  type ExtensionListing,
  extensionIconSource,
  formatDate,
} from "../../lib/extension-catalog";
import { listingPath } from "../../lib/listing-links";

export function ExtensionIcon({
  entry,
  large = false,
}: {
  entry: ExtensionListing;
  large?: boolean;
}) {
  const source = extensionIconSource(entry.icon);
  const [failedSource, setFailedSource] = useState<string>();
  const icon = source === failedSource ? defaultExtensionIcon : source;
  return (
    <span
      className={`extension-icon ${large ? "large" : ""}`}
      data-color={icon === defaultExtensionIcon ? "default" : entry.color}
    >
      <img
        key={icon}
        src={icon}
        onError={() => {
          if (icon !== defaultExtensionIcon) setFailedSource(source);
        }}
        referrerPolicy="no-referrer"
        width={large ? 40 : 30}
        height={large ? 40 : 30}
        alt=""
      />
    </span>
  );
}

export function ExtensionCard({ entry }: { entry: ExtensionListing }) {
  return (
    <article className="extension-card">
      <div className="card-heading">
        <ExtensionIcon entry={entry} />
        <div>
          <Link
            className="extension-title"
            to={listingPath("extensions", entry)}
          >
            <h2>{entry.metadata.name}</h2>
          </Link>
          <span className="author">by {entry.author}</span>
        </div>
      </div>
      <p className="card-summary">{entry.summary}</p>
      <div className="tag-list">
        <span>{entry.category}</span>
        {entry.tags.slice(0, 2).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <dl className="card-metadata">
        <div>
          <dt>GNOME Shell</dt>
          <dd>{entry.metadata["shell-version"].join(", ")}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <time dateTime={entry.updated}>{formatDate(entry.updated)}</time>
          </dd>
        </div>
      </dl>
      <div className="card-actions">
        <a href={entry.source} target="_blank" rel="noreferrer">
          Source <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <Link to={listingPath("extensions", entry)}>
          View extension <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
