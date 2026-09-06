import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import catalog from "../app/data/extensions.json";
import { loadCatalog } from "../app/lib/catalog-client";
import {
  type CatalogIdentity,
  type ListingReview,
  reviewListing,
} from "../app/lib/listing-review";

const marker = "<!-- vibe-gnome-listing-review -->";
export const reviewLabels = {
  changes: "review:needs-info",
  pending: "review:needs-human",
  confirmed: "review:confirmed",
} as const;

interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string }[];
  pull_request?: unknown;
}

interface Comment {
  id: number;
  body: string;
  user: { login: string; type: string };
}

export interface ReviewEvent {
  action: string;
  issue?: Issue;
  comment?: Comment;
}

export type GitHubRequest = <T>(
  path: string,
  method?: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
) => Promise<T>;

class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function listingFingerprint(issue: Pick<Issue, "title" | "body">) {
  return createHash("sha256")
    .update(JSON.stringify([issue.title, issue.body ?? ""]))
    .digest("hex");
}

function escapeReport(value: string) {
  return value
    .slice(0, 300)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}[\]()#+.!|~-]/g, "\\$&")
    .replace(/@/g, "&#64;")
    .replace(/\s+/g, " ");
}

export function renderReview(
  review: ListingReview | null,
  fingerprint: string,
  confirmedBy?: string,
) {
  const passed = review?.passed ?? false;
  return [
    marker,
    `<!-- submission:${fingerprint} checks:${passed ? "passed" : "failed"} -->`,
    "## Listing review",
    "",
    confirmedBy
      ? `**Human confirmation recorded from ${escapeReport(confirmedBy)}.**`
      : passed
        ? "**Basic checks passed — awaiting human confirmation.**"
        : "**Basic checks need changes before human confirmation.**",
    "",
    ...(review?.checks.map(
      (check) =>
        `- [${check.passed ? "x" : " "}] **${check.name}:** ${escapeReport(check.detail)}`,
    ) ?? [
      "Restore the app or extension submission fields to run the basic checks.",
    ]),
    "",
    "These checks validate submitted fields and URL syntax. A maintainer must verify upstream metadata, ownership, license, installation instructions, and suitability. Submitted links and code are not fetched or executed. Nothing is published automatically.",
    "",
    ...(passed && !confirmedBy
      ? [
          "After reviewing this exact submission, a maintainer with repository write access can post:",
          "",
          "```text",
          `/confirm-listing ${fingerprint}`,
          "```",
          "",
          "Editing the title or body requires new checks and confirmation.",
          "",
          "To approve and publish this exact submission to D1, post this command instead:",
          "",
          "```text",
          `/publish-listing ${fingerprint}`,
          "```",
        ]
      : []),
  ].join("\n");
}

async function findReport(request: GitHubRequest, issueNumber: number) {
  for (let page = 1; ; page++) {
    const comments = await request<Comment[]>(
      `/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    );
    const report = comments.find(
      (comment) =>
        comment.user.type === "Bot" &&
        comment.user.login === "github-actions[bot]" &&
        comment.body.startsWith(marker),
    );
    if (report || comments.length < 100) return report;
  }
}

async function setReviewLabel(
  request: GitHubRequest,
  issue: Issue,
  status: keyof typeof reviewLabels,
) {
  const name = reviewLabels[status];
  // Labels are created on first use, so installation needs no manual label setup.
  const labelPath = `/labels/${encodeURIComponent(name)}`;
  try {
    await request(labelPath);
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    try {
      await request("/labels", "POST", {
        name,
        color:
          status === "confirmed"
            ? "238636"
            : status === "pending"
              ? "0969da"
              : "d29922",
        description: "Managed by the listing review workflow.",
      });
    } catch (creationError) {
      // Another issue's run may have created this label in the meantime.
      if (
        !(creationError instanceof GitHubError) ||
        creationError.status !== 422
      )
        throw creationError;
      await request(labelPath);
    }
  }
  for (const label of issue.labels) {
    if (
      Object.values(reviewLabels).some((value) => value === label.name) &&
      label.name !== name
    )
      await request(
        `/issues/${issue.number}/labels/${encodeURIComponent(label.name)}`,
        "DELETE",
      );
  }
  await request(`/issues/${issue.number}/labels`, "POST", { labels: [name] });
}

/** All issue content stays data; only trusted default-branch code runs. */
export async function runListingReview(
  event: ReviewEvent,
  request: GitHubRequest,
  entries: readonly CatalogIdentity[] = catalog,
) {
  if (!event.issue || event.issue.pull_request)
    return "Skipped: not a listing issue.";
  const confirming = !!event.comment;
  const command = event.comment?.body
    .trim()
    .match(/^\/confirm-listing ([a-f0-9]{64})$/);
  if (
    confirming &&
    (!command ||
      event.action !== "created" ||
      event.comment?.user.type !== "User")
  )
    return "Skipped: not a human confirmation command.";

  // Permission checks use GitHub's current repository permissions, not issue association.
  if (confirming) {
    const permission = await request<{ permission: string }>(
      `/collaborators/${encodeURIComponent(event.comment?.user.login ?? "")}/permission`,
    );
    if (permission.permission !== "write" && permission.permission !== "admin")
      return "Confirmation refused: repository write access is required.";
  }

  // Read live issue state so queued events cannot approve an obsolete payload.
  const issue = await request<Issue>(`/issues/${event.issue.number}`);
  if (issue.state !== "open" || issue.pull_request)
    return "Skipped: issue is closed or is a pull request.";
  const existing = await findReport(request, issue.number);
  const review = reviewListing(issue.title, issue.body ?? "", entries);
  if (!review && !existing)
    return "Skipped: not an app or extension submission.";
  const fingerprint = listingFingerprint(issue);
  let confirmedBy: string | undefined;
  if (confirming) {
    if (
      !review?.passed ||
      command?.[1] !== fingerprint ||
      !existing?.body.includes(
        `<!-- submission:${fingerprint} checks:passed -->`,
      )
    )
      return "Confirmation refused: wait for passing checks, then copy the command from the current report.";
    confirmedBy = event.comment?.user.login;
  }

  const report = renderReview(review, fingerprint, confirmedBy);
  // Recheck after reading comments/permissions and before recording the result.
  const latest = await request<Issue>(`/issues/${issue.number}`);
  if (latest.state !== "open" || listingFingerprint(latest) !== fingerprint)
    throw new Error(
      "Submission changed during review. Rerun the workflow for the current issue.",
    );
  await setReviewLabel(
    request,
    latest,
    confirmedBy ? "confirmed" : review?.passed ? "pending" : "changes",
  );
  if (existing)
    await request(`/issues/comments/${existing.id}`, "PATCH", { body: report });
  else
    await request(`/issues/${issue.number}/comments`, "POST", { body: report });
  return report;
}

export function githubRequest(
  repository: string,
  token: string,
): GitHubRequest {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))
    throw new Error("Invalid GitHub repository.");
  return async <T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    const response = await fetch(
      `https://api.github.com/repos/${repository}${path}`,
      {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new GitHubError(
        `GitHub ${method} ${path} failed (${response.status}).`,
        response.status,
      );
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  };
}

if (import.meta.main) {
  const fixture = process.argv[2];
  if (fixture && fixture !== "--github") {
    // Local dry run: never reads credentials, contacts GitHub, or posts a comment.
    const issue = JSON.parse(readFileSync(fixture, "utf8")) as Issue;
    const review = reviewListing(issue.title, issue.body ?? "", catalog);
    console.log(renderReview(review, listingFingerprint(issue)));
    process.exitCode = review?.passed ? 0 : 1;
  } else if (fixture === "--github") {
    const {
      GITHUB_EVENT_PATH,
      GITHUB_REPOSITORY,
      GITHUB_TOKEN,
      GITHUB_STEP_SUMMARY,
    } = process.env;
    if (!GITHUB_EVENT_PATH || !GITHUB_REPOSITORY || !GITHUB_TOKEN)
      throw new Error("GitHub workflow environment is required.");
    const result = await runListingReview(
      JSON.parse(readFileSync(GITHUB_EVENT_PATH, "utf8")),
      githubRequest(GITHUB_REPOSITORY, GITHUB_TOKEN),
      await loadCatalog(
        "extensions",
        AbortSignal.timeout(20_000),
        (path, init) => fetch(`https://vibe-gnome.org${path}`, init),
      ),
    );
    if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${result}\n`);
    console.log(result);
    if (
      result.includes("checks:failed -->") ||
      result.startsWith("Confirmation refused:")
    )
      process.exitCode = 1;
  } else {
    throw new Error(
      "Usage: bun scripts/listing-review.ts <issue.json> (dry run), or --github (workflow only).",
    );
  }
}
