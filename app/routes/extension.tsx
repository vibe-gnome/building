import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Flag,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ExtensionIcon } from "../components/extensions/extension-card";
import { extensions, formatDate } from "../lib/extension-catalog";
import { issueUrl } from "../lib/extension-submissions";
import type { Route } from "./+types/extension";
import NotFound from "./extensions-not-found";

export function meta({ params }: Route.MetaArgs) {
  const entry = extensions.find((item) => item.slug === params.slug);
  return [
    { title: `${entry?.metadata.name ?? "Extension not found"} | Vibe GNOME` },
    {
      name: "description",
      content:
        entry?.summary ?? "Browse community-built GNOME Shell extensions.",
    },
    ...(!entry ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function Extension({ params }: Route.ComponentProps) {
  const entry = extensions.find((item) => item.slug === params.slug);
  const [copyState, setCopyState] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!entry) return <NotFound />;
  const copyUuid = async () => {
    try {
      await navigator.clipboard.writeText(entry.metadata.uuid);
      setCopyState("UUID copied");
    } catch {
      setCopyState("Could not copy. Select the UUID to copy it.");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState(""), 4000);
  };

  return (
    <main id="main-content" className="page-shell detail-page" tabIndex={-1}>
      <Link className="back-link" to="/extensions">
        <ArrowLeft size={16} aria-hidden="true" />
        All extensions
      </Link>
      <header className="detail-heading">
        <ExtensionIcon entry={entry} large />
        <div>
          <p className="eyebrow">{entry.category}</p>
          <h1>{entry.metadata.name}</h1>
          <p>
            by{" "}
            <a
              href={`https://github.com/${entry.author}`}
              target="_blank"
              rel="noreferrer"
            >
              {entry.author}
            </a>
          </p>
        </div>
      </header>
      <div className="detail-layout">
        <div className="detail-content">
          <p className="detail-summary">{entry.summary}</p>
          <p>{entry.details}</p>
          <h2>Features</h2>
          <ul className="feature-list">
            {entry.features.map((feature) => (
              <li key={feature}>
                <Check size={16} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <h2>Requirements</h2>
          <p>{entry.requirements}</p>
          <div className="tag-list">
            {entry.tags.map((tag) => (
              <Link key={tag} to={`/extensions?q=${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        </div>
        <aside className="detail-sidebar" aria-label="Extension information">
          <a
            className="button primary"
            href={entry.gnomeUrl ?? `${entry.source}#readme`}
            target="_blank"
            rel="noreferrer"
          >
            {entry.gnomeUrl
              ? "Get on GNOME Extensions"
              : "Installation instructions"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <a
            className="button"
            href={entry.source}
            target="_blank"
            rel="noreferrer"
          >
            View source <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <dl>
            <div>
              <dt>GNOME Shell</dt>
              <dd>{entry.metadata["shell-version"].join(", ")}</dd>
            </div>
            {entry.metadata.version && (
              <div>
                <dt>Version</dt>
                <dd>{entry.metadata.version}</dd>
              </div>
            )}
            <div>
              <dt>Updated</dt>
              <dd>
                <time dateTime={entry.updated}>
                  {formatDate(entry.updated)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Added to marketplace</dt>
              <dd>
                <time dateTime={entry.added}>{formatDate(entry.added)}</time>
              </dd>
            </div>
            <div>
              <dt>Extension UUID</dt>
              <dd className="uuid-value">
                <code>{entry.metadata.uuid}</code>
                <button
                  type="button"
                  className="icon-button"
                  title="Copy UUID"
                  aria-label="Copy extension UUID"
                  onClick={copyUuid}
                >
                  {copyState === "UUID copied" ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                </button>
              </dd>
            </div>
          </dl>
          <p className="copy-status" role="status">
            {copyState}
          </p>
          <div className="detail-listing-actions">
            <a
              href={issueUrl("update", entry)}
              target="_blank"
              rel="noreferrer"
            >
              <Pencil size={15} aria-hidden="true" />
              Update listing
            </a>
            <a
              href={issueUrl("remove", entry)}
              target="_blank"
              rel="noreferrer"
            >
              <Flag size={15} aria-hidden="true" />
              Report listing
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
