import { Blocks, Code2, Plus, RotateCcw, Search, Workflow } from "lucide-react";
import { CatalogControls } from "../components/catalog-controls";
import { ExtensionCard } from "../components/extensions/extension-card";
import { loadCatalog } from "../lib/catalog-client";
import { useCatalogQuery } from "../lib/catalog-query";
import { extensionFilters, filterExtensions } from "../lib/extension-catalog";
import { issueUrl } from "../lib/extension-submissions";
import type { Route } from "./+types/extensions";

export {
  CatalogError as ErrorBoundary,
  CatalogLoading as HydrateFallback,
} from "../components/catalog-status";

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadCatalog("extensions", request.signal);
}

export function shouldRevalidate() {
  return false;
}

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

export default function Catalog({
  loaderData: extensions,
}: Route.ComponentProps) {
  const { categories, shellVersions } = extensionFilters(extensions);
  const query = useCatalogQuery(["q", "category", "shell"]);
  const { params, update, reset, list } = query;
  const results = filterExtensions(extensions, params);
  const selectedCategory = params.get("category") ?? "";

  return (
    <main id="main-content" className="page-shell marketplace" tabIndex={-1}>
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Community marketplace</p>
          <h1>
            GNOME <span>Extensions</span>
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
          <CatalogControls
            subject="extensions"
            total={extensions.length}
            count={results.length}
            query={query}
            sortOptions={[
              { value: "added", label: "Recently added" },
              { value: "updated", label: "Recently updated" },
              { value: "name", label: "Name: A to Z" },
            ]}
          />
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
