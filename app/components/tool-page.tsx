import {
  ArrowUpRight,
  Blocks,
  ChevronRight,
  RotateCcw,
  Search,
  Tag,
} from "lucide-react";
import { Link } from "react-router";
import { useCatalogQuery } from "../lib/catalog-query";
import { listingPath } from "../lib/listing-links";
import { filterSkills, skillTags } from "../lib/skill-catalog";
import {
  type ToolCategory,
  type ToolEntry,
  toolCollections,
} from "../lib/tools";
import { CatalogControls } from "./catalog-controls";

function SkillCard({ entry }: { entry: ToolEntry }) {
  return (
    <article className="extension-card skill-card">
      <div className="card-heading">
        <span className="extension-icon" data-color="default">
          <img src="/icons/showcase/skills.svg" width={30} height={30} alt="" />
        </span>
        <div>
          <Link className="extension-title" to={listingPath("skills", entry)}>
            <h2>{entry.name}</h2>
          </Link>
        </div>
      </div>
      <p className="card-summary">{entry.description}</p>
      {entry.tags?.length ? (
        <div className="tag-list">
          {entry.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {entry.bestFor ? (
        <dl className="card-metadata">
          <div>
            <dt>Best for</dt>
            <dd>{entry.bestFor}</dd>
          </div>
        </dl>
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
        <Link to={listingPath("skills", entry)}>
          View skill <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
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
  const query = useCatalogQuery(["q", "tag"]);
  const { params, update, reset, list } = query;
  const tags = skillTags(entries);
  const selectedTag = (params.get("tag") ?? "").trim().toLocaleLowerCase();
  const results = filterSkills(entries, params);

  return (
    <main
      id="main-content"
      className="page-shell marketplace skill-catalog"
      tabIndex={-1}
    >
      <div className="page-intro catalog-intro">
        <div>
          <p className="eyebrow">Community marketplace</p>
          <h1>
            GNOME <span>{collection.title}</span>
          </h1>
        </div>
      </div>
      <div className="catalog-layout">
        <section className="catalog-filters" aria-label="Filter skills">
          <fieldset className="category-filter">
            <legend className="sr-only">Tags</legend>
            <button
              type="button"
              className="category-option"
              aria-pressed={!selectedTag}
              onClick={() => update("tag", "")}
            >
              <Blocks size={17} aria-hidden="true" />
              <span>All skills</span>
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
        <section className="catalog-results" aria-label="Skill catalog">
          <CatalogControls
            subject="skills"
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
                <SkillCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={30} aria-hidden="true" />
              <h2>No skills found</h2>
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
