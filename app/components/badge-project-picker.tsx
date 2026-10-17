import { useRef, useState } from "react";
import { badgeSiteUrl } from "../lib/badge";
import { findBadgeProjects } from "../lib/badge-projects";
import { useBadgeProjects } from "../lib/use-badge-projects";

export function BadgeProjectPicker({
  destination,
  onChange,
}: {
  destination: string | null;
  onChange: (url: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, retry } = useBadgeProjects();
  const selected =
    state.status === "ready"
      ? state.projects.find((project) => project.url === destination)
      : undefined;
  const matches =
    state.status === "ready" && !selected
      ? findBadgeProjects(state.projects, query)
      : [];
  const searching = Boolean(query.trim()) && !selected;

  return (
    <section className="badge-project" aria-labelledby="badge-project-heading">
      <h2 id="badge-project-heading">1. Link your project</h2>
      <p className="badge-step-description">
        Find your app or extension to send visitors straight to its Vibe GNOME
        page. Leave this blank to link to the homepage.
      </p>
      <label className="badge-project-label" htmlFor="badge-project-name">
        App or extension name
      </label>
      <input
        ref={inputRef}
        id="badge-project-name"
        className="badge-project-search"
        type="search"
        autoComplete="off"
        placeholder="Search by name"
        aria-describedby="badge-project-status"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          onChange(value.trim() ? null : badgeSiteUrl);
        }}
      />
      <p
        id="badge-project-status"
        className="badge-project-status"
        role="status"
      >
        {selected ? (
          <>
            Badge links to <a href={selected.url}>{selected.name}</a> ·{" "}
            {selected.category === "apps" ? "App" : "Extension"}
          </>
        ) : searching ? (
          state.status === "loading" ? (
            "Loading apps and extensions…"
          ) : state.status === "error" ? (
            "Could not load projects. Try again, or clear the name to link to the homepage."
          ) : matches.length ? (
            `${matches.length} ${matches.length === 1 ? "match" : "matches"}. Select your project below.`
          ) : (
            "No matching projects. Try another name, or clear the name to link to the homepage."
          )
        ) : (
          "Your badge links to the Vibe GNOME homepage."
        )}
      </p>
      {searching && state.status === "error" && (
        <button
          className="guide-retry"
          type="button"
          onClick={() => {
            retry();
            inputRef.current?.focus();
          }}
        >
          Try again
        </button>
      )}
      {matches.length > 0 && (
        <ul className="badge-project-results" aria-label="Matching projects">
          {matches.map((project) => (
            <li key={project.url}>
              <button
                type="button"
                onClick={() => {
                  setQuery(project.name);
                  onChange(project.url);
                  inputRef.current?.focus();
                }}
              >
                <strong>{project.name}</strong>
                <span>
                  {project.category === "apps" ? "App" : "Extension"} ·{" "}
                  {project.url.slice(badgeSiteUrl.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
