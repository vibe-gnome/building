import { appendFile } from "node:fs/promises";
import { appIdentitySource } from "../app/lib/app-identity";
import type {
  ResolveSkillIdentity,
  SkillIdentity,
} from "../app/server/skill-identity";
import {
  type AuditReport,
  checkSkillAudits,
  resolveSkillTarget,
  SkillAuditHttpError,
} from "./check-skill-audits";
import {
  type InstallSkill,
  installReviewSkill,
  SkillInstallError,
  skillInstallTarget,
  skillsCliVersion,
} from "./install-review-skill";
import { listingFingerprint } from "./listing-review";

const marker = "<!-- vibe-gnome:skill-audits -->";
const labels = {
  submission: "skill-submission",
  pending: "skill:audits-pending",
  blocked: "skill:audits-blocked",
  ready: "skill:awaiting-review",
};

interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  pull_request?: unknown;
  labels: { name: string }[];
}

interface Comment {
  id: number;
  body: string;
  user: { login: string };
}

export type GitHubRequest = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;

function isSkillSubmission(issue: Issue): boolean {
  return (
    !issue.pull_request &&
    (issue.title.startsWith("[Skill]") ||
      /^### (?:skills\.sh URL|Skill folder path)\r?$/m.test(issue.body ?? "") ||
      issue.labels.some((label) => label.name === labels.submission))
  );
}

function reportBody(
  report: AuditReport | undefined,
  error: string | undefined,
  runUrl: string,
  fingerprint: string,
  identity?: SkillIdentity,
  installed = false,
): string {
  const heading = report?.passed
    ? "Ready for human review"
    : "Skill review blocked";
  const evidence = report
    ? [
        `Source: [skills.sh](${report.url}) · Checked: ${report.checkedAt}`,
        "",
        "| Security audit | Result | Requirement |",
        "| --- | --- | --- |",
        ...report.audits.map(
          (audit) =>
            `| [${audit.name}](${audit.url}) | ${audit.status} | ${audit.required ? "Must PASS" : "Informational"} |`,
        ),
      ]
    : [error ?? "The audit results could not be verified."];
  return [
    marker,
    `<!-- submission:${fingerprint} checks:${report?.passed ? "passed" : "failed"} -->`,
    `## ${heading}`,
    "",
    ...evidence,
    ...(installed
      ? [
          "",
          `Installation: \`npx skills@${skillsCliVersion} add\` succeeded for the selected commit and folder in a temporary directory. Installation does not guarantee that skills.sh has indexed the skill or finished its audits.`,
        ]
      : []),
    ...(identity
      ? [
          "",
          `Source: [SKILL.md](<${appIdentitySource(identity)}>), commit \`${identity.commit}\`.`,
        ]
      : []),
    "",
    report?.passed
      ? "Gen Agent Trust Hub and Socket both passed. A human maintainer must now review the linked SKILL.md, permissions, license, GNOME relevance, and submitted revision. This check does not approve or publish the skill."
      : "Gen Agent Trust Hub and Socket must both show PASS. Missing, pending, unknown, WARN, FAIL, or unavailable required results block review. Correct the submission or wait for skills.sh to update, then edit/reopen the issue or ask a maintainer to run this workflow with the issue number.",
    "",
    "Snyk is informational. Audits describe the version scanned by skills.sh; the maintainer must compare it with the submitted commit. Editing or reopening the issue requires a new check and human review.",
    "",
    ...(report?.passed
      ? [
          "After reviewing this exact submission, a maintainer with repository write access can approve and publish it to D1:",
          "",
          "```text",
          `/publish-listing ${fingerprint}`,
          "```",
          "",
        ]
      : []),
    `[Workflow run](${runUrl})`,
  ].join("\n");
}

export async function checkInstalledSkillAudits(
  url: string,
  check: (url: string) => Promise<AuditReport> = checkSkillAudits,
  wait: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<AuditReport> {
  for (let attempt = 0; ; attempt++) {
    try {
      const report = await check(url);
      const required = report.audits.filter((audit) => audit.required);
      if (
        attempt === 2 ||
        report.passed ||
        required.some(
          (audit) => audit.status === "FAIL" || audit.status === "WARN",
        ) ||
        !required.some(
          (audit) => audit.status === "PENDING" || audit.status === "UNKNOWN",
        )
      )
        return report;
    } catch (error) {
      if (
        !(error instanceof SkillAuditHttpError) ||
        error.status !== 404 ||
        attempt === 2
      )
        throw error;
    }
    await wait(15_000);
  }
}

export async function reviewSkillSubmission(
  issueNumber: number,
  github: GitHubRequest,
  runUrl: string,
  check: (url: string) => Promise<AuditReport> = checkSkillAudits,
  resolveIdentity?: ResolveSkillIdentity,
  install: InstallSkill = installReviewSkill,
  wait?: (ms: number) => Promise<void>,
): Promise<{ passed: boolean; summary: string }> {
  const issuePath = `/issues/${issueNumber}`;
  const issue = await github<Issue>(issuePath);
  if (!isSkillSubmission(issue))
    throw new Error("This issue is not a skill submission.");
  if (issue.state !== "open")
    throw new Error("Reopen the submission before checking it.");

  // Create missing labels without overwriting a maintainer's colors/descriptions.
  for (const [kind, name] of Object.entries(labels)) {
    try {
      await github(`/labels`, "POST", {
        name,
        color: kind === "blocked" ? "b60205" : "5319e7",
      });
    } catch (error) {
      // A concurrent run may have created it; verify it exists before continuing.
      await github(`/labels/${encodeURIComponent(name)}`).catch(() => {
        throw error;
      });
    }
  }
  for (const label of issue.labels) {
    if (label.name === labels.ready || label.name === labels.blocked) {
      await github(
        `${issuePath}/labels/${encodeURIComponent(label.name)}`,
        "DELETE",
      );
    }
  }
  await github(`${issuePath}/labels`, "POST", {
    labels: [labels.submission, labels.pending],
  });

  let existing: Comment | undefined;
  for (let page = 1; ; page++) {
    const comments = await github<Comment[]>(
      `${issuePath}/comments?per_page=100&page=${page}`,
    );
    existing = comments.find(
      (comment) =>
        comment.user.login === "github-actions[bot]" &&
        comment.body.startsWith(marker),
    );
    if (existing || comments.length < 100) break;
  }
  const updateComment = async (body: string) => {
    if (existing) {
      await github(`/issues/comments/${existing.id}`, "PATCH", { body });
    } else {
      existing = await github<Comment>(`${issuePath}/comments`, "POST", {
        body,
      });
    }
  };
  await updateComment(
    `${marker}\n## Installing skill and checking skills.sh audits\n\nPrevious results are superseded. Human review must wait for the temporary installation and required audit checks to finish.\n\n[Workflow run](${runUrl})`,
  );

  let report: AuditReport | undefined;
  let identity: SkillIdentity | undefined;
  let error: string | undefined;
  let installed = false;
  try {
    const target = await resolveSkillTarget(issue.body ?? "", resolveIdentity);
    identity = target.identity;
    await install(skillInstallTarget(issue.body ?? "", identity));
    installed = true;
    report = await checkInstalledSkillAudits(target.url.href, check, wait);
  } catch (reason) {
    // Our validators use fixed messages. Network errors may contain remote text;
    // don't echo arbitrary server content, issue text, or credentials to GitHub.
    error =
      reason instanceof SkillInstallError
        ? reason.message
        : reason instanceof Error &&
            /^(Use an HTTPS|Provide exactly one|Provide a repository root|Source repository URL|Skill folder path|SKILL\.md|skills\.sh|Repository |The repository |Metadata file )/.test(
              reason.message,
            )
          ? reason.message
          : "The repository or audit request failed or timed out. Retry the workflow later.";
  }

  const current = await github<Issue>(issuePath);
  if (
    current.body !== issue.body ||
    current.title !== issue.title ||
    current.state !== "open"
  ) {
    report = undefined;
    error =
      "The submission changed or closed during this check. Reopen it or run a fresh check before review.";
  }
  const summary = reportBody(
    report,
    error,
    runUrl,
    listingFingerprint(issue, identity),
    identity,
    installed,
  );
  await updateComment(summary);
  await github(`${issuePath}/labels`, "POST", {
    labels: [report?.passed ? labels.ready : labels.blocked],
  });
  await github(
    `${issuePath}/labels/${encodeURIComponent(labels.pending)}`,
    "DELETE",
  );
  return { passed: report?.passed ?? false, summary };
}

if (import.meta.main) {
  try {
    const repository = process.env.GITHUB_REPOSITORY ?? "";
    const token = process.env.GITHUB_TOKEN;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token)
      throw new Error("Missing GitHub workflow credentials.");
    const event = await Bun.file(process.env.GITHUB_EVENT_PATH ?? "").json();
    const number = String(
      event.inputs?.issue_number ?? event.issue?.number ?? "",
    );
    if (!/^[1-9]\d*$/.test(number) || !Number.isSafeInteger(Number(number)))
      throw new Error("Provide a positive issue number.");
    const github: GitHubRequest = async <T>(
      path: string,
      method = "GET",
      body?: unknown,
    ): Promise<T> => {
      const response = await fetch(
        `https://api.github.com/repos/${repository}${path}`,
        {
          method,
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      if (!response.ok)
        throw new Error(`GitHub API returned HTTP ${response.status}.`);
      return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);
    };
    const result = await reviewSkillSubmission(
      Number(number),
      github,
      `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${result.summary}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Skill review failed.",
    );
    process.exitCode = 1;
  }
}
