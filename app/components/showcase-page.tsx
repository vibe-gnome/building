import { Blocks, Plus, RotateCcw, Search, Tag } from "lucide-react";
import { appTags, filterApps } from "../lib/app-catalog";
import { useCatalogQuery } from "../lib/catalog-query";
import { type ShowcaseEntry, showcaseSubmissionUrl } from "../lib/showcases";
import { AppCard } from "./app-card";
import { CatalogControls } from "./catalog-controls";

export function ShowcasePage({
  category,
  entries,
}: {
  category: "apps";
  entries: readonly ShowcaseEntry[];
}) {
  const query = useCatalogQuery(["q", "tag"]);
  const { params, update, reset, list } = query;
  const tags = appTags(entries);
  const selectedTag = (params.get("tag") ?? "").trim().toLocaleLowerCase();
  const results = filterApps(entries, params);

  return (
    <main
      id="main-content"
      className="page-shell marketplace app-catalog"
      tabIndex={-1}
    >
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Community marketplace</p>
          <h1>
            GNOME <span>Apps</span>
          </h1>
        </div>
        <a
          className="button primary submit-button"
          href={showcaseSubmissionUrl(category)}
          target="_blank"
          rel="noreferrer"
        >
          <Plus size={17} aria-hidden="true" />
          Submit app
        </a>
      </div>
      <div className="catalog-layout">
        <section className="catalog-filters" aria-label="Filter apps">
          <fieldset className="category-filter">
            <legend className="sr-only">Tags</legend>
            <button
              type="button"
              className="category-option"
              aria-pressed={!selectedTag}
              onClick={() => update("tag", "")}
            >
              <Blocks size={17} aria-hidden="true" />
              <span>All apps</span>
              <span className="count">{entries.length}</span>
            </button>
            {tags.map((tag) => (
              <button
                type="button"
                className="category-option"
                key={tag.name}
                aria-pressed={selectedTag === tag.name.toLocaleLowerCase()}
                onClick={() => update("tag", tag.name)}
              >
                <Tag size={17} aria-hidden="true" />
                <span>{tag.name}</span>
                <span className="count">{tag.count}</span>
              </button>
            ))}
          </fieldset>
        </section>
        <section className="catalog-results" aria-label="App catalog">
          <CatalogControls
            subject="apps"
            total={entries.length}
            count={results.length}
            query={query}
            sortOptions={[
              { value: "added", label: "Recently added" },
              { value: "name", label: "Name: A to Z" },
            ]}
          />
          {results.length > 0 ? (
            <div className={`extension-grid ${list ? "list-view" : ""}`}>
              {results.map((entry) => (
                <AppCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={30} aria-hidden="true" />
              <h2>No apps found</h2>
              {query.filtered && (
                <button className="button" type="button" onClick={reset}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
