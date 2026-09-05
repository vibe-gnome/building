import {
  Blocks,
  Code2,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Workflow,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { ExtensionCard } from "../components/extensions/extension-card";
import {
  categories,
  extensions,
  filterExtensions,
  shellVersions,
} from "../lib/extension-catalog";
import { issueUrl } from "../lib/extension-submissions";

export function meta() {
  return [
    { title: "Extensions | Vibe GNOME" },
    {
      name: "description",
      content:
        "Community-built GNOME Shell extensions. Browse extensions, inspect their source, and submit or update a listing.",
    },
  ];
}

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const results = filterExtensions(extensions, params);
  const selectedCategory = params.get("category") ?? "";
  const list = params.get("view") === "list";
  const filtered = ["q", "category", "shell"].some((key) => !!params.get(key));
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { preventScrollReset: true, replace: key === "q" },
    );
  const reset = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of ["q", "category", "shell"]) next.delete(key);
        return next;
      },
      { preventScrollReset: true },
    );

  return (
    <main id="main-content" className="page-shell marketplace" tabIndex={-1}>
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Community marketplace</p>
          <h1>
            Vibe GNOME <span>Extensions</span>
          </h1>
        </div>
        <a
          className="button primary submit-button"
          href={issueUrl("submit")}
          target="_blank"
          rel="noreferrer"
        >
          <Plus size={17} aria-hidden="true" />
          Submit extension
        </a>
      </div>
      <div className="catalog-layout">
        <section className="catalog-filters" aria-label="Filter extensions">
          <fieldset className="category-filter">
            <legend className="sr-only">Categories</legend>
            <button
              type="button"
              className="category-option"
              aria-pressed={!selectedCategory}
              onClick={() => update("category", "")}
            >
              <Blocks size={17} aria-hidden="true" />
              <span>All extensions</span>
              <span className="count">{extensions.length}</span>
            </button>
            {categories.map((category) => {
              const Icon = category === "Developer tools" ? Code2 : Workflow;
              return (
                <button
                  type="button"
                  className="category-option"
                  key={category}
                  aria-pressed={selectedCategory === category}
                  onClick={() => update("category", category)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{category}</span>
                  <span className="count">
                    {
                      extensions.filter((entry) => entry.category === category)
                        .length
                    }
                  </span>
                </button>
              );
            })}
          </fieldset>
          <div className="shell-filter">
            <label htmlFor="shell-version">GNOME Shell</label>
            <select
              id="shell-version"
              value={params.get("shell") ?? ""}
              onChange={(event) => update("shell", event.target.value)}
            >
              <option value="">All versions</option>
              {params.get("shell") &&
                !shellVersions.includes(params.get("shell") ?? "") && (
                  <option value={params.get("shell") ?? ""}>
                    {params.get("shell")}
                  </option>
                )}
              {shellVersions.map((version) => (
                <option key={version} value={version}>
                  GNOME {version}
                </option>
              ))}
            </select>
          </div>
        </section>
        <section className="catalog-results" aria-label="Extension catalog">
          <div className="catalog-toolbar">
            <div className="search-field">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search extensions"
                type="search"
                placeholder="Search extensions, authors, tags..."
                value={params.get("q") ?? ""}
                onChange={(event) => update("q", event.target.value)}
              />
              {params.get("q") && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => update("q", "")}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <select
              className="sort-select"
              aria-label="Sort extensions"
              value={
                params.get("sort") === "name" ||
                params.get("sort") === "updated"
                  ? (params.get("sort") ?? "added")
                  : "added"
              }
              onChange={(event) => update("sort", event.target.value)}
            >
              <option value="added">Recently added</option>
              <option value="updated">Recently updated</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
          <div className="results-heading">
            <p role="status">
              {results.length}{" "}
              {results.length === 1 ? "extension" : "extensions"}
              {filtered ? ` of ${extensions.length}` : ""}
            </p>
            <div className="results-actions">
              {filtered && (
                <button type="button" className="text-button" onClick={reset}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Clear filters
                </button>
              )}
              <fieldset className="view-toggle" aria-label="Catalog layout">
                <button
                  type="button"
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={!list}
                  onClick={() => update("view", "")}
                >
                  <LayoutGrid size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="List view"
                  aria-label="List view"
                  aria-pressed={list}
                  onClick={() => update("view", "list")}
                >
                  <List size={17} aria-hidden="true" />
                </button>
              </fieldset>
            </div>
          </div>
          {results.length > 0 ? (
            <div className={`extension-grid ${list ? "list-view" : ""}`}>
              {results.map((entry) => (
                <ExtensionCard key={entry.slug} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={30} aria-hidden="true" />
              <h2>No extensions found</h2>
              <p>Try another search or clear the filters.</p>
              <button className="button" type="button" onClick={reset}>
                <RotateCcw size={16} aria-hidden="true" />
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
