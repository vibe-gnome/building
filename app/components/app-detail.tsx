import { ArrowLeft, ArrowUpRight, Check, Copy, Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { appRepositoryInfo } from "../lib/app-catalog";
import { site } from "../lib/extension-submissions";
import type { ShowcaseEntry } from "../lib/showcases";
import { AppIcon } from "./app-icon";
import { ListingScreenshot } from "./listing-screenshot";
import { ViewCount } from "./view-count";

export function AppDetail({ entry }: { entry: ShowcaseEntry }) {
  const [copyState, setCopyState] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const repository = appRepositoryInfo(entry.href);
  const installationUrl = new URL(entry.href);
  installationUrl.hash = "readme";
  const ownerUrl = new URL(entry.href);
  ownerUrl.pathname = `/${repository.owner}`;
  ownerUrl.search = "";
  ownerUrl.hash = "";
  const reportUrl = new URL(`${site.repository}/issues/new`);
  reportUrl.searchParams.set("title", `[App report] ${entry.name}`);
  reportUrl.searchParams.set(
    "body",
    `App: ${entry.name}\nRepository: ${entry.href}${entry.appId ? `\nApp ID: ${entry.appId}` : ""}\n\nDescribe the issue with this listing:\n`,
  );
  const copyAppId = async () => {
    if (!entry.appId) return;
    try {
      await navigator.clipboard.writeText(entry.appId);
      setCopyState("App ID copied");
    } catch {
      setCopyState("Could not copy. Select the App ID to copy it.");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState(""), 4000);
  };

  return (
    <main
      id="main-content"
      className="page-shell detail-page app-detail-page"
      tabIndex={-1}
    >
      <Link className="back-link" to="/apps">
        <ArrowLeft size={16} aria-hidden="true" />
        All apps
      </Link>
      <header className="detail-heading">
        <AppIcon src={entry.icon} large />
        <div>
          <p className="eyebrow">Community app</p>
          <h1>{entry.name}</h1>
          {repository.owner && (
            <p>
              by{" "}
              <a href={ownerUrl.href} target="_blank" rel="noreferrer">
                {repository.owner}
              </a>
            </p>
          )}
        </div>
      </header>
      <div className="detail-layout">
        <div className="detail-content">
          <p className="detail-summary">{entry.summary}</p>
          <ListingScreenshot src={entry.screenshot} name={entry.name} />
          {entry.tags.length > 0 && (
            <div className="tag-list">
              {entry.tags.map((tag) => (
                <Link key={tag} to={`/apps?tag=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside className="detail-sidebar" aria-label="App information">
          <a
            className="button primary"
            href={installationUrl.href}
            target="_blank"
            rel="noreferrer"
          >
            Installation instructions{" "}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <a
            className="button"
            href={entry.href}
            target="_blank"
            rel="noreferrer"
          >
            View source <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <dl>
            <ViewCount category="apps" slug={entry.id} />
            <div>
              <dt>Repository</dt>
              <dd>
                <a href={entry.href} target="_blank" rel="noreferrer">
                  {repository.host}
                </a>
              </dd>
            </div>
            {entry.submittedBy && (
              <div>
                <dt>Submitted by</dt>
                <dd>{entry.submittedBy}</dd>
              </div>
            )}
            {entry.appId && (
              <div>
                <dt>App ID</dt>
                <dd className="uuid-value">
                  <code>{entry.appId}</code>
                  <button
                    type="button"
                    className="icon-button"
                    title="Copy App ID"
                    aria-label="Copy App ID"
                    onClick={copyAppId}
                  >
                    {copyState === "App ID copied" ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Copy size={16} aria-hidden="true" />
                    )}
                  </button>
                </dd>
              </div>
            )}
          </dl>
          <p className="copy-status" role="status">
            {copyState}
          </p>
          <div className="detail-listing-actions">
            <a href={reportUrl.href} target="_blank" rel="noreferrer">
              <Flag size={15} aria-hidden="true" />
              Report listing
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
