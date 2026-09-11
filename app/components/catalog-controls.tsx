import { LayoutGrid, List, RotateCcw, Search, X } from "lucide-react";
import type { useCatalogQuery } from "../lib/catalog-query";

export function CatalogControls({
  subject,
  total,
  count,
  query: { params, update, reset, filtered, list },
  sortOptions,
}: {
  subject: "apps" | "extensions" | "skills";
  total: number;
  count: number;
  query: ReturnType<typeof useCatalogQuery>;
  sortOptions: readonly { value: string; label: string }[];
}) {
  const sort = params.get("sort") ?? "added";
  return (
    <>
      <div className="catalog-toolbar">
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label={`Search ${subject}`}
            type="search"
            placeholder={
              subject === "skills"
                ? "Search skills, tags..."
                : `Search ${subject}, authors, tags...`
            }
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
          aria-label={`Sort ${subject}`}
          value={
            sortOptions.some((option) => option.value === sort) ? sort : "added"
          }
          onChange={(event) => update("sort", event.target.value)}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="results-heading">
        <p role="status">
          {count} {count === 1 ? subject.slice(0, -1) : subject}
          {filtered ? ` of ${total}` : ""}
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
    </>
  );
}
