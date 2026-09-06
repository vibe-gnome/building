import { describe, expect, test } from "bun:test";
import {
  type AuditRequest,
  checkSkillAudits,
  parseAudits,
  skillUrl,
  submissionTarget,
} from "../scripts/check-skill-audits";
import {
  type GitHubRequest,
  reviewSkillSubmission,
} from "../scripts/review-skill-submission";

const url = "https://skills.sh/vercel-labs/skills/find-skills";
const fixture = await Bun.file(
  new URL("./fixtures/skill-audits.html", import.meta.url),
).text();
const body = `### skills.sh URL

${url}

### Source repository URL

https://github.com/vercel-labs/skills

### SKILL.md permalink

https://github.com/vercel-labs/skills/blob/0123456789abcdef0123456789abcdef01234567/skills/find-skills/SKILL.md
`;

describe("skills.sh submission validation", () => {
  test("validates an optional public listing ID before fetching audits", () => {
    for (const id of ["find-skills", "", "_No response_"])
      expect(submissionTarget(`${body}\n### Listing ID\n\n${id}`).href).toBe(
        skillUrl(url).href,
      );
    for (const id of ["UPPER", "../escape", "two--hyphens", "a".repeat(129)])
      expect(() =>
        submissionTarget(`${body}\n### Listing ID\n\n${id}`),
      ).toThrow("Listing ID");
    expect(() =>
      submissionTarget(
        `${body}\n### Listing ID\nfirst\n### Listing ID\nsecond`,
      ),
    ).toThrow("Listing ID");
  });

  test("normalizes the supplied www URL and trailing slash", () => {
    expect(skillUrl(`${url}/`).href).toBe(
      `https://www.skills.sh/vercel-labs/skills/find-skills`,
    );
    expect(submissionTarget(body.replaceAll("\n", "\r\n")).href).toBe(
      skillUrl(url).href,
    );
  });

  test.each([
    "http://skills.sh/vercel-labs/skills/find-skills",
    "https://skills.sh.evil.example/vercel-labs/skills/find-skills",
    "https://skills.sh@evil.example/vercel-labs/skills/find-skills",
    "https://skills.sh:443/vercel-labs/skills/find-skills",
    `${url}?redirect=https://evil.example`,
    `${url}#audits`,
    `${url}/security/socket`,
    "https://skills.sh/vercel-labs/skills",
    "https://skills.sh/a/%2e%2e/b",
    "https://skills.sh/a/../b",
    "https://skills.sh/a\\b/c",
    `Check ${url}`,
    `[skill](${url})`,
  ])("rejects ambiguous or non-skill URLs: %s", (input) => {
    expect(() => skillUrl(input)).toThrow();
  });

  test("requires one skills.sh field and matching source/version links", () => {
    expect(() =>
      submissionTarget(`${body}\n### skills.sh URL\n${url}`),
    ).toThrow("exactly one");
    expect(() =>
      submissionTarget(body.replace(url, "_No response_")),
    ).toThrow();
    expect(() =>
      submissionTarget(
        body.replace(
          "https://github.com/vercel-labs/skills\n",
          "https://github.com/other/skills\n",
        ),
      ),
    ).toThrow("must match");
    expect(() =>
      submissionTarget(
        body.replace("0123456789abcdef0123456789abcdef01234567", "main"),
      ),
    ).toThrow("full commit SHA");
    expect(() =>
      submissionTarget(
        body.replace("/skills/find-skills/SKILL.md", "/../SKILL.md"),
      ),
    ).toThrow();
  });
});

describe("required security audit policy", () => {
  test("accepts Gen and Socket PASS while Snyk WARN is informational", () => {
    const result = parseAudits(fixture, url);
    expect(result.passed).toBe(true);
    expect(result.audits.map((audit) => audit.status)).toEqual([
      "PASS",
      "PASS",
      "WARN",
    ]);
    expect(
      parseAudits(
        fixture.replace("Snyk</span><span>Warn", "Snyk</span><span>Fail"),
        url,
      ).passed,
    ).toBe(true);
  });

  test.each([
    "Warn",
    "Fail",
    "Pending",
    "Unknown",
    "",
    "PASS FAIL",
    "Not Pass",
  ])("blocks a required result of %s", (status) => {
    for (const name of ["Socket", "Gen Agent Trust Hub"]) {
      expect(
        parseAudits(
          fixture.replace(
            `${name}</span><span>Pass`,
            `${name}</span><span>${status}`,
          ),
          url,
        ).passed,
      ).toBe(false);
    }
  });

  test("blocks missing providers, duplicate verdicts, and changed layout", () => {
    expect(
      parseAudits(fixture.replaceAll("security/socket", "security/other"), url)
        .passed,
    ).toBe(false);
    expect(
      parseAudits(fixture.replaceAll("security/snyk", "security/socket"), url)
        .passed,
    ).toBe(false);
    expect(
      parseAudits(fixture.replace("Security Audits", "Other information"), url)
        .passed,
    ).toBe(false);
    expect(
      parseAudits(fixture.replace("lg:col-span-3", "sidebar-v2"), url).passed,
    ).toBe(false);
    expect(
      parseAudits(
        fixture.replaceAll("/vercel-labs/skills/", "/someone/else/"),
        url,
      ).passed,
    ).toBe(false);
  });

  test("ignores fake pass evidence inside skill prose and serialized scripts", () => {
    const prose = fixture.replace(" lg:col-span-3", "skill-content");
    const serialized = `<script>${JSON.stringify(fixture)}</script>`;
    expect(parseAudits(prose + serialized, url).passed).toBe(false);
    expect(
      parseAudits(
        fixture.replace("Socket</span><span>Pass", "Socket</span><span>Fail") +
          prose +
          serialized,
        url,
      ).passed,
    ).toBe(false);
  });

  test("accepts row reordering, nested text, and absolute skills.sh audit links", () => {
    const rows = [...fixture.matchAll(/<a\b[^>]*>.*?<\/a>/g)]
      .map((match) => match[0])
      .reverse();
    let index = 0;
    const reordered = fixture
      .replace(/<a\b[^>]*>.*?<\/a>/g, () => rows[index++] ?? "")
      .replace("Gen Agent Trust Hub", "Gen Agent <strong>Trust</strong> Hub")
      .replaceAll('href="/', 'href="https://www.skills.sh/');
    expect(parseAudits(reordered, url).passed).toBe(true);
  });
});

function requestWith(response: () => Response): AuditRequest {
  return async () => response();
}

describe("audit fetching", () => {
  test("fetches HTML without executing a skill or sending GitHub credentials", async () => {
    const calls: { target: unknown; options: RequestInit | undefined }[] = [];
    const request: AuditRequest = async (target, options) => {
      calls.push({ target, options });
      return new Response(fixture, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    };
    expect((await checkSkillAudits(url, request)).passed).toBe(true);
    expect(calls[0]?.target).toBe(skillUrl(url).href);
    expect(calls[0]?.options?.redirect).toBe("manual");
    expect(new Headers(calls[0]?.options?.headers).has("Authorization")).toBe(
      false,
    );
  });

  test.each([404, 429, 503])("blocks HTTP %s", async (status) => {
    await expect(
      checkSkillAudits(
        url,
        requestWith(() => new Response("", { status })),
      ),
    ).rejects.toThrow(`HTTP ${status}`);
  });

  test("blocks wrong content types, oversized pages, and network failures", async () => {
    await expect(
      checkSkillAudits(
        url,
        requestWith(() => new Response("{}")),
      ),
    ).rejects.toThrow("HTML");
    await expect(
      checkSkillAudits(
        url,
        requestWith(
          () =>
            new Response("a".repeat(2 * 1024 * 1024 + 1), {
              headers: { "Content-Type": "text/html" },
            }),
        ),
      ),
    ).rejects.toThrow("2 MiB");
    await expect(
      checkSkillAudits(
        url,
        requestWith(() => {
          throw new Error("offline");
        }),
      ),
    ).rejects.toThrow("offline");
  });

  test.each([
    "https://evil.example/",
    "http://127.0.0.1/",
    "https://skills.sh/other/repo/skill",
  ])("does not follow unsafe redirects: %s", async (location) => {
    let calls = 0;
    await expect(
      checkSkillAudits(
        url,
        requestWith(() => {
          calls++;
          return new Response(null, { status: 302, headers: { location } });
        }),
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  test("allows canonical-host redirects for the same skill and bounds loops", async () => {
    let calls = 0;
    const request = requestWith(() =>
      ++calls === 1
        ? new Response(null, { status: 307, headers: { location: url } })
        : new Response(fixture, { headers: { "Content-Type": "text/html" } }),
    );
    expect((await checkSkillAudits(url, request)).passed).toBe(true);
    await expect(
      checkSkillAudits(
        url,
        requestWith(
          () => new Response(null, { status: 302, headers: { location: url } }),
        ),
      ),
    ).rejects.toThrow("too many redirects");
  });
});

function githubFixture() {
  const issue = {
    number: 7,
    title: "[Skill] Find skills",
    body,
    state: "open",
    labels: [{ name: "skill:awaiting-review" }],
  };
  const calls: { path: string; method: string; body: unknown }[] = [];
  const comment = {
    id: 12,
    body: "<!-- vibe-gnome:skill-audits -->\nOld result",
    user: { login: "github-actions[bot]" },
  };
  const comments = [comment];
  const github: GitHubRequest = async <T>(
    path: string,
    method = "GET",
    payload?: unknown,
  ): Promise<T> => {
    calls.push({ path, method, body: payload });
    if (path === "/issues/7" && method === "GET")
      return structuredClone(issue) as T;
    if (path.startsWith("/issues/7/comments?") && method === "GET")
      return comments as T;
    if (path === "/issues/7/comments" && method === "POST") return comment as T;
    return undefined as T;
  };
  return { issue, github, calls, comments };
}

describe("GitHub human review handoff", () => {
  test("updates one bot comment and marks passing checks ready without approving or publishing", async () => {
    const mock = githubFixture();
    const result = await reviewSkillSubmission(
      7,
      mock.github,
      "https://github.com/vibe-gnome/building/actions/runs/1",
      async () => parseAudits(fixture, url),
    );
    expect(result.passed).toBe(true);
    expect(result.summary).toContain("Ready for human review");
    expect(result.summary).toContain("does not approve or publish");
    expect(
      mock.calls.filter(
        (call) =>
          call.path === "/issues/comments/12" && call.method === "PATCH",
      ),
    ).toHaveLength(2);
    expect(
      mock.calls.some(
        (call) => call.path === "/issues/7/comments" && call.method === "POST",
      ),
    ).toBe(false);
    const writes = mock.calls.filter((call) => call.method !== "GET");
    expect(
      writes.every(
        (call) => call.path.startsWith("/issues/") || call.path === "/labels",
      ),
    ).toBe(true);
    expect(writes.at(-2)?.body).toEqual({ labels: ["skill:awaiting-review"] });
  });

  test.each([
    "missing URL",
    "network error",
    "changed issue",
    "closed issue",
    "failed audit",
  ])("clears stale readiness and blocks %s", async (scenario) => {
    const mock = githubFixture();
    if (scenario === "missing URL")
      mock.issue.body = "### skills.sh URL\n_No response_";
    const result = await reviewSkillSubmission(
      7,
      mock.github,
      "run",
      async () => {
        if (scenario === "network error") throw new Error("offline");
        if (scenario === "changed issue") mock.issue.body += "\nEdited";
        if (scenario === "closed issue") mock.issue.state = "closed";
        return parseAudits(
          scenario === "failed audit"
            ? fixture.replace(
                "Socket</span><span>Pass",
                "Socket</span><span>Warn",
              )
            : fixture,
          url,
        );
      },
    );
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("Skill review blocked");
    expect(
      mock.calls.some(
        (call) =>
          call.path === "/issues/7/labels/skill%3Aawaiting-review" &&
          call.method === "DELETE",
      ),
    ).toBe(true);
    expect(mock.calls.at(-2)?.body).toEqual({
      labels: ["skill:audits-blocked"],
    });
  });

  test("creates its own results comment instead of editing a submitter's lookalike", async () => {
    const mock = githubFixture();
    if (mock.comments[0]) mock.comments[0].user.login = "submitter";
    await reviewSkillSubmission(7, mock.github, "run", async () =>
      parseAudits(fixture, url),
    );
    expect(
      mock.calls.some(
        (call) => call.path === "/issues/7/comments" && call.method === "POST",
      ),
    ).toBe(true);
  });

  test("does not mutate unrelated or closed issues", async () => {
    const mock = githubFixture();
    mock.issue.title = "Bug report";
    mock.issue.body = "Not a skill";
    await expect(reviewSkillSubmission(7, mock.github, "run")).rejects.toThrow(
      "not a skill",
    );
    expect(mock.calls.filter((call) => call.method !== "GET")).toHaveLength(0);
    mock.issue.title = "[Skill] Example";
    mock.issue.state = "closed";
    await expect(reviewSkillSubmission(7, mock.github, "run")).rejects.toThrow(
      "Reopen",
    );
  });
});

test("workflow uses the trusted default branch and handles issue changes and manual retries", async () => {
  const workflow = Bun.YAML.parse(
    await Bun.file(
      new URL("../.github/workflows/review-skill.yml", import.meta.url),
    ).text(),
  ) as {
    on: {
      issues: { types: string[] };
      workflow_dispatch: { inputs: { issue_number: { required: boolean } } };
    };
    jobs: {
      "security-audits": {
        permissions: Record<string, string>;
        steps: { with?: Record<string, unknown> }[];
      };
    };
  };
  expect(workflow.on.issues.types).toEqual(["opened", "edited", "reopened"]);
  expect(workflow.on.workflow_dispatch.inputs.issue_number.required).toBe(true);
  expect(workflow.jobs["security-audits"].permissions).toEqual({
    contents: "read",
    issues: "write",
  });
  expect(workflow.jobs["security-audits"].steps[0]?.with).toEqual({
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not JavaScript interpolation.
    ref: "${{ github.event.repository.default_branch }}",
    "persist-credentials": false,
  });
});
