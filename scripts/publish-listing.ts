import { appendFile } from "node:fs/promises";
import { type AppIdentity, appIdentitySlug } from "../app/lib/app-identity";
import type { ExtensionListing } from "../app/lib/extension-catalog";
import type { ExtensionIdentity } from "../app/lib/extension-identity";
import { listingPath } from "../app/lib/listing-links";
import { parseIssueFields, reviewListing } from "../app/lib/listing-review";
import {
  type CatalogListing,
  isListingSlug,
  type ListingCategory,
} from "../app/lib/listings";
import {
  type ResolveAppIdentity,
  resolveAppIdentity,
} from "../app/server/app-identity";
import {
  type ResolveExtensionIdentity,
  resolveExtensionIdentity,
} from "../app/server/extension-identity";
import {
  type AuditReport,
  checkSkillAudits,
  submissionTarget,
} from "./check-skill-audits";
import {
  assertAppIdentitySchema,
  assertListingIdSchema,
  d1QueryFromEnv,
  type SqlQuery,
} from "./d1-catalog";
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
interface ManualPublishEvent {
  inputs: { issue_number?: unknown; approval_comment_id?: unknown };
}
interface Comment {
  body: string;
  user: { login: string; type: string };
}

export async function resolvePublishEvent(
  event: PublishEvent | ManualPublishEvent,
  github: GitHubRequest,
  repository: string,
): Promise<PublishEvent> {
  if (!("inputs" in event)) return event;
  const { issue_number: issueNumber, approval_comment_id: commentId } =
    event.inputs;
  for (const value of [issueNumber, commentId]) {
    if (typeof value !== "string" || !/^[1-9]\d{0,14}$/.test(value))
      throw new Error(
        "Enter positive issue and approval comment numbers without leading zeros.",
      );
  }
  const comment = await github<
    PublishEvent["comment"] & {
      issue_url: string;
      created_at: string;
      updated_at: string;
    }
  >(`/issues/comments/${commentId}`);
  if (
    comment.id !== Number(commentId) ||
    comment.issue_url !==
      `https://api.github.com/repos/${repository}/issues/${issueNumber}` ||
    !comment.created_at ||
    comment.created_at !== comment.updated_at
  )
    throw new Error(
      "The approval must be an unedited comment on this submission issue.",
    );
  return {
    action: "created",
    issue: await github<Issue>(`/issues/${issueNumber}`),
    comment,
  };
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
  appIdentity?: AppIdentity,
  existingSlug?: string,
  extensionIdentity?: ExtensionIdentity,
): { category: ListingCategory; slug: string; payload: CatalogListing } {
  const field = fieldsFor(issue.body ?? "");
  const app = !!field("App name") && !field("Skill name");
  if (app && !appIdentity)
    throw new Error("A repository app ID is required for publication.");
  const slug =
    existingSlug ??
    (app && appIdentity
      ? appIdentitySlug(appIdentity.appId)
      : `submission-${issue.number}`);
  if (!isListingSlug(slug))
    throw new Error("The stored listing key is invalid.");
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
        appId: appIdentity?.appId,
        summary: field("Summary"),
        href: field("Repository or project URL"),
        submittedBy: field("Author and license"),
        tags: field("Tags")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    };
  const updating = !extensionIdentity && !!field("Extension UUID");
  const raw = updating ? field("Updated metadata.json") : "";
  const metadata = updating
    ? raw
      ? metadataJson(raw)
      : existing?.metadata
    : extensionIdentity?.metadata;
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
      gnomeUrl: updating
        ? field("GNOME Extensions listing", existing?.gnomeUrl) || undefined
        : existing?.gnomeUrl,
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
  SELECT ?1, ?2, 'published', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9
  WHERE ?1 != 'apps' OR json_extract(?3, '$.appId') IS NULL OR NOT EXISTS (
    SELECT 1 FROM listings WHERE category = 'apps' AND slug != ?2
      AND json_extract(payload, '$.appId') = json_extract(?3, '$.appId')
  )
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
  resolveIdentity: ResolveAppIdentity = resolveAppIdentity,
  resolveExtension: ResolveExtensionIdentity = resolveExtensionIdentity,
): Promise<string> {
  const command = event.comment?.body
    .trim()
    .match(/^\/(?:publish|confirm)-listing ([a-f0-9]{64})$/);
  if (
    event.action !== "created" ||
    !command ||
    event.comment.user.type !== "User" ||
    event.issue.pull_request
  )
    throw new Error(
      "A new human /publish-listing or /confirm-listing command is required.",
    );
  const actor = event.comment.user.login;
  const permission = await github<{ permission: string }>(
    `/collaborators/${encodeURIComponent(actor)}/permission`,
  );
  if (!["write", "admin"].includes(permission.permission))
    throw new Error("Publication requires repository write access.");
  const issue = await github<Issue>(`/issues/${event.issue.number}`);
  const issueFingerprint = listingFingerprint(issue);
  if (issue.state !== "open" || issue.pull_request)
    throw new Error(
      "Submission changed or closed. Wait for fresh checks and approve the current fingerprint.",
    );
  const field = fieldsFor(issue.body ?? "");
  const skill = !!field("Skill name");
  let appIdentity: AppIdentity | undefined;
  let extensionIdentity: ExtensionIdentity | undefined;
  if (!skill && field("App name")) {
    if (!reviewListing(issue.title, issue.body ?? "", [])?.passed)
      throw new Error(
        "Current listing validation failed. Fix the submission and review it again.",
      );
    appIdentity = await resolveIdentity(field("Repository or project URL"));
  }
  if (!skill && !appIdentity) {
    const review = reviewListing(issue.title, issue.body ?? "", []);
    if (review?.kind === "extension") {
      if (!review.passed)
        throw new Error(
          "Current listing validation failed. Fix the submission and review it again.",
        );
      extensionIdentity = await resolveExtension(field("Source repository"));
    }
  }
  const fingerprint = listingFingerprint(
    issue,
    appIdentity ?? extensionIdentity,
  );
  if (command[1] !== fingerprint)
    throw new Error(
      "Submission or repository revision changed. Rerun checks and approve the current fingerprint.",
    );
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

  if (appIdentity) await assertAppIdentitySchema(query);
  await assertListingIdSchema(query);

  const catalog = await query(
    "SELECT payload, revision, source_issue FROM listings WHERE category = 'extensions'",
  );
  const extensions = catalog.results.map(
    (row) => JSON.parse(String(row.payload)) as ExtensionListing,
  );
  const existing = extensionIdentity
    ? null
    : (extensions.find(
        (entry) => entry.metadata.uuid === field("Extension UUID"),
      ) ?? null);
  let audits: AuditReport | undefined;
  if (skill) {
    audits = await checkAudits(submissionTarget(issue.body ?? "").href);
    if (!audits.passed)
      throw new Error(
        "Both required skills.sh audits must still PASS at publication.",
      );
  } else {
    const review = reviewListing(
      issue.title,
      issue.body ?? "",
      extensions,
      extensionIdentity,
    );
    if (!review?.passed)
      throw new Error(
        "Current listing validation failed. Fix the submission and review it again.",
      );
  }
  const now = new Date().toISOString();
  const previousSubmission =
    appIdentity || skill
      ? (
          await query(
            "SELECT slug, payload, revision, source_issue FROM listings WHERE category = ? AND source_issue = ?",
            [skill ? "skills" : "apps", issue.number],
          )
        ).results[0]
      : undefined;
  if (previousSubmission && appIdentity) {
    const previousId = JSON.parse(String(previousSubmission.payload)).appId;
    if (previousId && previousId !== appIdentity.appId)
      throw new Error(
        "The repository app ID changed for an existing listing. A maintainer must resolve the identity change.",
      );
  }
  const { category, slug, payload } = publicationData(
    issue,
    existing,
    now,
    appIdentity,
    previousSubmission ? String(previousSubmission.slug) : undefined,
    extensionIdentity,
  );
  if (appIdentity) {
    const duplicate = await query(
      "SELECT slug FROM listings WHERE category = 'apps' AND json_extract(payload, '$.appId') = ? AND slug != ?",
      [appIdentity.appId, slug],
    );
    if (duplicate.results.length)
      throw new Error("This app ID belongs to another listing.");
  }
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
      category === "apps"
        ? "The detected app ID belongs to another submission."
        : "The stored listing belongs to another submission.",
    );
  const latest = await github<Issue>(`/issues/${issue.number}`);
  if (
    latest.state !== "open" ||
    listingFingerprint(latest) !== issueFingerprint
  )
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
      appIdentity: appIdentity ?? null,
      extensionIdentity: extensionIdentity ?? null,
    }),
    now,
    typeof row?.revision === "string" ? row.revision : null,
  ]);
  if (result.results.length !== 1)
    throw new Error(
      "Listing changed during publication. Review its latest version before retrying.",
    );
  const identity = await query(
    "SELECT id FROM listing_ids WHERE category = ? AND slug = ?",
    [category, slug],
  );
  const path = listingPath(category, {
    ...payload,
    dbId: Number(identity.results[0]?.id),
  });
  return `Published [${path}](https://vibe-gnome.org${path}) to D1. Approved by ${actor}; submission fingerprint ${fingerprint}.`;
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
    const github = githubRequest(GITHUB_REPOSITORY, GITHUB_TOKEN);
    const event = await resolvePublishEvent(
      await Bun.file(GITHUB_EVENT_PATH).json(),
      github,
      GITHUB_REPOSITORY,
    );
    const result = await publishListing(event, github, d1QueryFromEnv());
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
