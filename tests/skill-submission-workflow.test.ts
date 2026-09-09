import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { RepositoryFetcher } from "../app/server/repository-metadata";
import { resolveSkillIdentity } from "../app/server/skill-identity";
import { parseAudits, resolveSkillTarget } from "../scripts/check-skill-audits";
import { publishListing } from "../scripts/publish-listing";
import {
  type GitHubRequest,
  reviewSkillSubmission,
} from "../scripts/review-skill-submission";
import { catalogDatabase } from "./helpers/catalog-db";

const repository = "https://github.com/vercel-labs/skills";
const url = "https://www.skills.sh/vercel-labs/skills/find-skills";
const auditHtml = readFileSync("tests/fixtures/skill-audits.html", "utf8");
const description = "Find reusable guidance for GNOME development.";

function upstream(path = "skills/discovery/SKILL.md") {
  const state = {
    commit: "a".repeat(40),
    source: `---\nname: find-skills\ndescription: >\n  ${description}\n---\n\nSkill instructions are not executed.`,
    mode: "100644",
    size: 1024,
    truncated: false,
    missing: false,
  };
  const calls: string[] = [];
  const fetcher: RepositoryFetcher = async (input, init) => {
    calls.push(input);
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    const api = "https://api.github.com/repos/vercel-labs/skills";
    if (input === api) return Response.json({ default_branch: "main" });
    if (input === `${api}/commits/main`)
      return Response.json({ sha: state.commit });
    if (input === `${api}/git/trees/${state.commit}?recursive=1`)
      return Response.json({
        truncated: state.truncated,
        tree: state.missing
          ? []
          : [
              { path, type: "blob", mode: state.mode, size: state.size },
              ...Array.from({ length: 25 }, (_, i) => ({
                path: `skills/other-${i}/SKILL.md`,
                type: "blob",
                mode: "100644",
              })),
            ],
      });
    if (input === `${api}/contents/${path}?ref=${state.commit}`)
      return new Response(state.source);
    throw new Error(`Unexpected repository request: ${input}`);
  };
  return {
    state,
    calls,
    resolve: (repo: string, folder: string) =>
      resolveSkillIdentity(repo, folder, fetcher),
  };
}

function formIssue(values: Record<string, string> = {}) {
  const form = Bun.YAML.parse(
    readFileSync(".github/ISSUE_TEMPLATE/submit-skill.yml", "utf8"),
  ) as {
    title: string;
    body: {
      attributes: { label?: string };
      validations?: { required?: boolean };
    }[];
  };
  const answers: Record<string, string> = {
    "Skill name": "Find GNOME skills",
    "Source repository URL": repository,
    "Skill folder path": "skills/discovery",
    ...values,
  };
  const fields = form.body.filter((field) => field.attributes.label);
  expect(fields.map((field) => field.attributes.label)).toEqual([
    "Skill name",
    "Source repository URL",
    "Skill folder path",
    "Summary",
    "Tags",
  ]);
  return {
    number: 42,
    title: `${form.title}Find GNOME skills`,
    body: fields
      .map((field) => {
        const label = field.attributes.label ?? "";
        if (field.validations?.required) expect(answers[label]).toBeDefined();
        return `### ${label}\n\n${answers[label] ?? "_No response_"}`;
      })
      .join("\n\n"),
    state: "open",
    labels: [] as { name: string }[],
  };
}

describe("skill folder resolution", () => {
  test.each(["skills/discovery", "skills/discovery/", "."])(
    "resolves %s at a pinned commit and uses the declared name",
    async (folder) => {
      const path = folder === "." ? "SKILL.md" : "skills/discovery/SKILL.md";
      const repo = upstream(path);
      const issue = formIssue({ "Skill folder path": folder });
      const target = await resolveSkillTarget(
        issue.body.replaceAll("\n", "\r\n"),
        repo.resolve,
      );
      expect(target.url.href).toBe(url);
      expect(target.identity).toEqual({
        repository,
        commit: repo.state.commit,
        path,
        skillName: "find-skills",
        description,
      });
      expect(repo.calls).toHaveLength(4);
    },
  );

  test.each([
    "",
    "/skills/discovery",
    "../discovery",
    "skills/../discovery",
    "https://example.com/skill",
    "skills/%2e%2e",
    "skills\\discovery",
    "skills/discovery/SKILL.md",
  ])("rejects invalid folder %s before fetching", async (folder) => {
    const repo = upstream();
    await expect(repo.resolve(repository, folder)).rejects.toThrow(
      "Skill folder path",
    );
    expect(repo.calls).toHaveLength(0);
  });

  test.each([
    "missing",
    "symlink",
    "oversized",
    "incomplete tree",
    "missing frontmatter",
    "invalid YAML",
    "invalid name",
    "invalid description",
  ])("blocks %s", async (reason) => {
    const repo = upstream();
    if (reason === "missing") repo.state.missing = true;
    if (reason === "symlink") repo.state.mode = "120000";
    if (reason === "oversized") repo.state.size = 256 * 1024 + 1;
    if (reason === "incomplete tree") repo.state.truncated = true;
    if (reason === "missing frontmatter") repo.state.source = "# Instructions";
    if (reason === "invalid YAML") repo.state.source = "---\nname: [\n---\n";
    if (reason === "invalid name")
      repo.state.source = repo.state.source.replace("find-skills", "../other");
    if (reason === "invalid description")
      repo.state.source = "---\nname: find-skills\ndescription: []\n---\n";
    await expect(
      repo.resolve(repository, "skills/discovery"),
    ).rejects.toThrow();
  });

  test("rejects unsupported repositories, duplicate fields, and blank paths", async () => {
    const repo = upstream();
    await expect(
      repo.resolve("https://gitlab.com/owner/repo", "."),
    ).rejects.toThrow("GitHub");
    for (const body of [
      `${formIssue().body}\n\n### Skill folder path\n\nskills/other`,
      formIssue({ "Skill folder path": "_No response_" }).body,
    ])
      await expect(resolveSkillTarget(body, repo.resolve)).rejects.toThrow(
        "exactly one",
      );
    expect(repo.calls).toHaveLength(0);
  });
});

test.each([
  { summary: undefined, tags: undefined },
  { summary: "Custom GNOME summary", tags: "GNOME, GTK, GNOME, , Libadwaita" },
])(
  "current skill form completes review and publication: %j",
  async ({ summary, tags }) => {
    const issue = formIssue({
      ...(summary ? { Summary: summary } : {}),
      ...(tags ? { Tags: tags } : {}),
    });
    const repo = upstream();
    const comments: {
      id: number;
      body: string;
      user: { login: string; type: string };
    }[] = [];
    const github: GitHubRequest = async <T>(
      path: string,
      method = "GET",
      payload?: unknown,
    ): Promise<T> => {
      if (path === "/issues/42" && method === "GET")
        return structuredClone(issue) as T;
      if (path === "/issues/42/comments?per_page=100&page=1")
        return structuredClone(comments) as T;
      if (path === "/issues/42/comments" && method === "POST") {
        const comment = {
          id: 100,
          body: (payload as { body: string }).body,
          user: { login: "github-actions[bot]", type: "Bot" },
        };
        comments.push(comment);
        return comment as T;
      }
      if (path === "/issues/comments/100" && method === "PATCH") {
        if (comments[0]) comments[0].body = (payload as { body: string }).body;
        return comments[0] as T;
      }
      if (path === "/labels" && method === "POST") return undefined as T;
      if (path === "/issues/42/labels" && method === "POST") {
        issue.labels.push(
          ...(payload as { labels: string[] }).labels.map((name) => ({ name })),
        );
        return undefined as T;
      }
      if (path.startsWith("/issues/42/labels/") && method === "DELETE") {
        issue.labels = issue.labels.filter(
          (label) =>
            label.name !==
            decodeURIComponent(path.slice("/issues/42/labels/".length)),
        );
        return undefined as T;
      }
      if (path === "/collaborators/maintainer/permission")
        return { permission: "write" } as T;
      throw new Error(`Unexpected GitHub request: ${method} ${path}`);
    };
    let failAudits = false;
    const check = async (target: string) => {
      expect(target).toBe(url);
      return parseAudits(
        failAudits
          ? auditHtml.replace(
              "Socket</span><span>Pass",
              "Socket</span><span>Fail",
            )
          : auditHtml,
        target,
      );
    };
    const data = catalogDatabase();
    try {
      // The folder heading also routes a submission after its title is edited.
      issue.title = "Find GNOME skills";
      const report = await reviewSkillSubmission(
        42,
        github,
        "run",
        check,
        repo.resolve,
      );
      expect(report.passed).toBe(true);
      expect(report.summary).toContain(
        `${repository}/blob/${repo.state.commit}/skills/discovery/SKILL.md`,
      );
      expect(issue.labels).toEqual([
        { name: "skill-submission" },
        { name: "skill:awaiting-review" },
      ]);
      expect(await data.catalog.list("skills")).toEqual([]);
      const command = report.summary.match(
        /\/publish-listing [a-f0-9]{64}/,
      )?.[0];
      if (!command) throw new Error("Missing approval command");
      const event = {
        action: "created",
        issue,
        comment: {
          id: 999,
          body: command,
          user: { login: "maintainer", type: "User" },
        },
      };
      const publish = () =>
        publishListing(
          event,
          github,
          data.query,
          check,
          undefined,
          undefined,
          repo.resolve,
        );
      repo.state.commit = "b".repeat(40);
      await expect(publish()).rejects.toThrow("revision changed");
      repo.state.commit = "a".repeat(40);
      failAudits = true;
      await expect(publish()).rejects.toThrow("must still PASS");
      expect(await data.catalog.list("skills")).toEqual([]);
      failAudits = false;
      const result = await publish();
      const saved = await data.catalog.get("skills", "submission-42");
      expect(saved?.description).toBe(summary ?? description);
      expect(saved?.tags).toEqual(tags ? ["GNOME", "GTK", "Libadwaita"] : []);
      expect(saved?.href).toBe(url);
      expect(result).toContain(`/skills/${saved?.dbId}/find-skills`);
      const row = (
        await data.query(
          "SELECT evidence FROM listing_reviews WHERE source_issue = 42",
        )
      ).results[0];
      const evidence = JSON.parse(String(row?.evidence));
      expect(evidence.body).toBe(issue.body);
      expect(evidence.skillIdentity.commit).toBe(repo.state.commit);
      expect(evidence.skillIdentity.path).toBe("skills/discovery/SKILL.md");
      issue.body += "\nEdited";
      await expect(publish()).rejects.toThrow("revision changed");
    } finally {
      data.db.close();
    }
  },
);
