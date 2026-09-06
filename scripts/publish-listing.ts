import { appendFile } from "node:fs/promises";
import type { ExtensionListing } from "../app/lib/extension-catalog";
import { parseIssueFields, reviewListing } from "../app/lib/listing-review";
import {
  type CatalogListing,
  isListingSlug,
  type ListingCategory,
} from "../app/lib/listings";
import {
  type AuditReport,
  checkSkillAudits,
  submissionTarget,
} from "./check-skill-audits";
import { d1QueryFromEnv, type SqlQuery } from "./d1-catalog";
import {
  type GitHubRequest,
  githubRequest,
  listingFingerprint,
} from "./listing-review";

interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  pull_request?: unknown;
}
export interface PublishEvent {
  action: string;
  issue: Issue;
  comment: { id: number; body: string; user: { login: string; type: string } };
}
interface Comment {
  body: string;
  user: { login: string; type: string };
}

function fieldsFor(body: string) {
  const { fields, duplicates } = parseIssueFields(body);
  if (duplicates.length)
    throw new Error(
      "Remove duplicate submission field headings before publication.",
    );
  return (label: string, fallback = "") => {
    const value = fields.get(label.toLowerCase());
    return !value || value === "_No response_" ? fallback : value;
  };
}

function metadataJson(value: string): ExtensionListing["metadata"] {
  return JSON.parse(
    value.replace(/^(`{3,}|~{3,})(?:json)?\s*\n([\s\S]*?)\n\1\s*$/i, "$2"),
  );
}

export function publicationData(
  issue: Issue,
  existing: ExtensionListing | null,
  now: string,
): { category: ListingCategory; slug: string; payload: CatalogListing } {
  const field = fieldsFor(issue.body ?? "");
  const slug = field("Listing ID", `submission-${issue.number}`);
  if (!isListingSlug(slug))
    throw new Error(
      "Listing ID must be at most 128 lowercase letters, numbers, and hyphens.",
    );
  if (field("Skill name")) {
    const url = submissionTarget(issue.body ?? "");
    for (const label of [
      "Summary",
      "Installation and usage",
      "Author and license",
      "Your relationship to the skill",
      "Permissions and external services",
    ]) {
      if (!field(label))
        throw new Error(`Complete ${label} before publishing the skill.`);
    }
    return {
      category: "skills",
      slug,
      payload: {
        id: slug,
        name: field("Skill name"),
        description: field("Summary"),
        href: url.href,
      },
    };
  }
  if (field("App name"))
    return {
      category: "apps",
      slug,
      payload: {
        id: slug,
        name: field("App name"),
        summary: field("Summary"),
        href: field("Repository or project URL"),
        submittedBy: field("Author and license"),
        tags: field("Tags")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    };
  const updating = !!field("Extension UUID");
  const raw = field(updating ? "Updated metadata.json" : "metadata.json");
  const metadata = raw ? metadataJson(raw) : existing?.metadata;
  if (!metadata)
    throw new Error("Extension metadata is required for publication.");
  if (updating && !existing)
    throw new Error("The extension to update was not found in D1.");
  const source = field("Source repository");
  const parts = field("Category and tags")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const id = existing?.slug ?? slug;
  return {
    category: "extensions",
    slug: id,
    payload: {
      ...existing,
      slug: id,
      metadata: { ...metadata, name: field("Extension name") },
      author:
        existing?.author ??
        new URL(source).pathname.split("/").filter(Boolean)[0] ??
        "Community",
      source,
      gnomeUrl:
        field("GNOME Extensions listing", existing?.gnomeUrl) || undefined,
      category: parts[0] ?? existing?.category ?? "Community",
      tags: parts.length ? parts.slice(1) : (existing?.tags ?? []),
      icon: existing?.icon ?? "/logo.svg",
      color: existing?.color ?? "blue",
      added: existing?.added ?? now.slice(0, 10),
      updated: now.slice(0, 10),
      summary: field("Summary", existing?.summary ?? metadata.description),
      details: field(
        "Details",
        existing?.details ?? field("Summary", metadata.description),
      ),
      requirements: field(
        "Requirements",
        existing?.requirements ?? "See the source repository for requirements.",
      ),
      features: existing?.features ?? [],
    },
  };
}

export const publishSql = `INSERT INTO listings
  (category, slug, status, payload, source_issue, revision, submission_fingerprint, reviewed_by, evidence, created_at, updated_at)
  VALUES (?1, ?2, 'published', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
  ON CONFLICT (category, slug) DO UPDATE SET
    payload = excluded.payload, status = 'published', source_issue = excluded.source_issue,
    revision = excluded.revision, submission_fingerprint = excluded.submission_fingerprint,
    reviewed_by = excluded.reviewed_by, evidence = excluded.evidence, updated_at = excluded.updated_at
  WHERE listings.revision = ?10
  RETURNING slug`;

async function hasPassingReport(
  github: GitHubRequest,
  issue: number,
  fingerprint: string,
  skill: boolean,
) {
  for (let page = 1; ; page++) {
    const comments = await github<Comment[]>(
      `/issues/${issue}/comments?per_page=100&page=${page}`,
    );
    if (
      comments.some(
        (comment) =>
          comment.user.type === "Bot" &&
          comment.user.login === "github-actions[bot]" &&
          comment.body.startsWith(
            skill
              ? "<!-- vibe-gnome:skill-audits -->"
              : "<!-- vibe-gnome-listing-review -->",
          ) &&
          comment.body.includes(
            `<!-- submission:${fingerprint} checks:passed -->`,
          ),
      )
    )
      return true;
    if (comments.length < 100) return false;
  }
}

export async function publishListing(
  event: PublishEvent,
  github: GitHubRequest,
  query: SqlQuery,
  checkAudits = checkSkillAudits,
): Promise<string> {
  const command = event.comment?.body
    .trim()
    .match(/^\/publish-listing ([a-f0-9]{64})$/);
  if (
    event.action !== "created" ||
    !command ||
    event.comment.user.type !== "User" ||
    event.issue.pull_request
  )
    throw new Error("A new human /publish-listing command is required.");
  const actor = event.comment.user.login;
  const permission = await github<{ permission: string }>(
    `/collaborators/${encodeURIComponent(actor)}/permission`,
  );
  if (!["write", "admin"].includes(permission.permission))
    throw new Error("Publication requires repository write access.");
  const issue = await github<Issue>(`/issues/${event.issue.number}`);
  const fingerprint = listingFingerprint(issue);
  if (
    issue.state !== "open" ||
    issue.pull_request ||
    command[1] !== fingerprint
  )
    throw new Error(
      "Submission changed or closed. Wait for fresh checks and approve the current fingerprint.",
    );
  const field = fieldsFor(issue.body ?? "");
  const skill = !!field("Skill name");
  if (!(await hasPassingReport(github, issue.number, fingerprint, skill)))
    throw new Error(
      "Wait for the current submission's automated checks to pass before publishing.",
    );
  const revision = `comment-${event.comment.id}`;
  const prior = await query(
    "SELECT slug FROM listing_reviews WHERE revision LIKE ? AND source_issue = ?",
    [`%:${revision}`, issue.number],
  );
  if (prior.results.length)
    return "This approval has already been published. No data changed.";

  const catalog = await query(
    "SELECT payload, revision, source_issue FROM listings WHERE category = 'extensions'",
  );
  const extensions = catalog.results.map(
    (row) => JSON.parse(String(row.payload)) as ExtensionListing,
  );
  const existing =
    extensions.find(
      (entry) => entry.metadata.uuid === field("Extension UUID"),
    ) ?? null;
  let audits: AuditReport | undefined;
  if (skill) {
    audits = await checkAudits(submissionTarget(issue.body ?? "").href);
    if (!audits.passed)
      throw new Error(
        "Both required skills.sh audits must still PASS at publication.",
      );
  } else {
    const review = reviewListing(issue.title, issue.body ?? "", extensions);
    if (!review?.passed)
      throw new Error(
        "Current listing validation failed. Fix the submission and review it again.",
      );
  }
  const now = new Date().toISOString();
  const { category, slug, payload } = publicationData(issue, existing, now);
  const previous = existing
    ? {
        results: catalog.results.filter(
          (row) => JSON.parse(String(row.payload)).slug === existing.slug,
        ),
      }
    : await query(
        "SELECT revision, source_issue FROM listings WHERE category = ? AND slug = ?",
        [category, slug],
      );
  const row = previous.results[0];
  if (row && !existing && row.source_issue !== issue.number)
    throw new Error(
      "Listing ID belongs to another submission. Choose a unique Listing ID.",
    );
  const latest = await github<Issue>(`/issues/${issue.number}`);
  if (latest.state !== "open" || listingFingerprint(latest) !== fingerprint)
    throw new Error(
      "Submission changed during publication. Run the checks again.",
    );
  const result = await query(publishSql, [
    category,
    slug,
    JSON.stringify(payload),
    issue.number,
    revision,
    fingerprint,
    actor,
    JSON.stringify({
      title: issue.title,
      body: issue.body,
      approvalComment: event.comment.id,
      audits: audits ?? null,
    }),
    now,
    typeof row?.revision === "string" ? row.revision : null,
  ]);
  if (result.results.length !== 1)
    throw new Error(
      "Listing changed during publication. Review its latest version before retrying.",
    );
  return `Published [${category}/${slug}](https://vibe-gnome.org/${category}/${slug}) to D1. Approved by ${actor}; submission fingerprint ${fingerprint}.`;
}

if (import.meta.main) {
  try {
    const {
      GITHUB_EVENT_PATH,
      GITHUB_REPOSITORY,
      GITHUB_TOKEN,
      GITHUB_STEP_SUMMARY,
    } = process.env;
    if (!GITHUB_EVENT_PATH || !GITHUB_REPOSITORY || !GITHUB_TOKEN)
      throw new Error("GitHub workflow environment is required.");
    const result = await publishListing(
      await Bun.file(GITHUB_EVENT_PATH).json(),
      githubRequest(GITHUB_REPOSITORY, GITHUB_TOKEN),
      d1QueryFromEnv(),
    );
    console.log(result);
    if (GITHUB_STEP_SUMMARY)
      await appendFile(GITHUB_STEP_SUMMARY, `${result}\n`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Publication failed.",
    );
    process.exitCode = 1;
  }
}
