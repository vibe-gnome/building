import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  isPublicHttpsUrl,
  parseIssueFields,
  reviewListing,
} from "../app/lib/listing-review";
import {
  type GitHubRequest,
  listingFingerprint,
  type ReviewEvent,
  renderReview,
  reviewLabels,
  runListingReview,
} from "../scripts/listing-review";

const metadata = {
  uuid: "example@example.org",
  name: "Example Extension",
  description: "A focused desktop extension.",
  "shell-version": ["3.38", "45", "50"],
};
const appFields = {
  "App name": "Example App",
  "Repository or project URL": "https://github.com/example/app",
  Summary: "A focused desktop app.",
  "Installation and usage":
    "Install from the documented Flatpak package, then open Example App.",
  "Author and license": "Example Maintainer, MIT",
};
const extensionFields = {
  "Extension name": metadata.name,
  "Source repository": "https://github.com/example/extension",
  "GNOME Extensions listing": "_No response_",
  "metadata.json": `\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\``,
  Summary: metadata.description,
  "Your relationship to the extension": "Author",
};
const body = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([name, value]) => `### ${name}\n\n${value}`)
    .join("\n\n");
const extensionReview = (changes: Record<string, unknown>) =>
  reviewListing(
    "[Submit] Example",
    body({
      ...extensionFields,
      "metadata.json": JSON.stringify({ ...metadata, ...changes }),
    }),
    [],
  );

describe("basic listing checks", () => {
  test("validates optional public listing IDs before requesting approval", () => {
    for (const fields of [appFields, extensionFields]) {
      for (const id of ["my-project", "", "_No response_"]) {
        expect(
          reviewListing("", body({ ...fields, "Listing ID": id }), [])?.passed,
        ).toBe(true);
      }
      for (const id of [
        "UPPER",
        "../escape",
        "two--hyphens",
        "a".repeat(129),
      ]) {
        expect(
          reviewListing("", body({ ...fields, "Listing ID": id }), [])?.passed,
        ).toBe(false);
      }
    }
  });

  test("accepts complete app submissions and the official minimal extension metadata", () => {
    expect(reviewListing("[App] Example", body(appFields), [])?.passed).toBe(
      true,
    );
    expect(
      reviewListing("[Submit] Example", body(extensionFields), [])?.passed,
    ).toBe(true);
    // Numeric version and metadata URL are optional for the local catalog.
    expect(
      extensionReview({ version: 2, url: "https://example.org/extension" })
        ?.passed,
    ).toBe(true);
  });

  test("every required app field rejects missing values and GitHub placeholders", () => {
    for (const field of Object.keys(appFields)) {
      for (const value of ["", "   ", "_No response_"]) {
        expect(
          reviewListing(
            "[App] Example",
            body({ ...appFields, [field]: value }),
            [],
          )?.passed,
        ).toBe(false);
      }
    }
  });

  test("reports incomplete and malformed extension metadata", () => {
    for (const raw of [
      "",
      "_No response_",
      "{broken}",
      "[]",
      "null",
      '"text"',
      "42",
    ]) {
      const result = reviewListing(
        "[Submit] Example",
        body({ ...extensionFields, "metadata.json": raw }),
        [],
      );
      expect(result?.passed).toBe(false);
      expect(
        result?.checks.find((check) => check.name === "metadata.json")?.passed,
      ).toBe(false);
    }
    for (const changes of [
      { uuid: "not-a-uuid" },
      { uuid: "name@example.org/escape" },
      { name: "Different Name" },
      { description: " " },
      { "shell-version": [] },
      { "shell-version": [50] },
      { "shell-version": ["50.1"] },
      { "shell-version": ["39"] },
      { "shell-version": ["3.40"] },
      { "shell-version": ["50", "50"] },
      { version: "1" },
      { version: 0 },
      { version: 1.5 },
      { url: "javascript:alert(1)" },
    ])
      expect(extensionReview(changes)?.passed).toBe(false);
  });

  test("rejects duplicate submissions and matches updates to catalog UUIDs", () => {
    const catalog = [{ metadata }];
    expect(
      reviewListing("[Submit] Example", body(extensionFields), catalog)?.passed,
    ).toBe(false);
    const update = {
      "Extension name": metadata.name,
      "Extension UUID": metadata.uuid,
      "Source repository": extensionFields["Source repository"],
      "Requested changes": "Correct the listing summary.",
      "Updated metadata.json": "_No response_",
      "Your relationship to the extension": "Author",
    };
    expect(
      reviewListing("[Update] Example", body(update), catalog)?.passed,
    ).toBe(true);
    expect(reviewListing("[Update] Example", body(update), [])?.passed).toBe(
      false,
    );
    expect(
      reviewListing(
        "[Update] Example",
        body({
          ...update,
          "Updated metadata.json": JSON.stringify({
            ...metadata,
            uuid: "different@example.org",
          }),
        }),
        catalog,
      )?.passed,
    ).toBe(false);
    expect(
      reviewListing(
        "[Update] Example",
        body({ ...update, "Updated metadata.json": JSON.stringify(metadata) }),
        catalog,
      )?.passed,
    ).toBe(true);
  });

  test("ignores skill submissions, ordinary issues, and removal reports", () => {
    expect(
      reviewListing("[Skill] Example", "### Skill name\nExample", []),
    ).toBeNull();
    expect(reviewListing("Bug", "Something broke", [])).toBeNull();
    expect(
      reviewListing("[Remove] Example", body(extensionFields), []),
    ).toBeNull();
    expect(
      reviewListing(
        "Retitled report",
        body({ ...extensionFields, Reason: "Please remove it" }),
        [],
      ),
    ).toBeNull();
    expect(reviewListing("Retitled app", body(appFields), [])?.kind).toBe(
      "app",
    );
  });

  test("handles CRLF, code fences, and duplicate fields without treating fenced headings as metadata", () => {
    const text =
      "### Summary\r\n\r\n```text\r\n### Fake field\r\nexample\r\n```\r\n\r\n### App name\r\nExample";
    const parsed = parseIssueFields(text);
    expect(parsed.fields.has("fake field")).toBe(false);
    expect(parsed.fields.get("app name")).toBe("Example");
    expect(
      reviewListing(
        "[App] Example",
        `${body(appFields)}\n\n### App name\nDuplicate`,
        [],
      )?.passed,
    ).toBe(false);
    expect(
      reviewListing(
        "[Submit] Example",
        body({
          ...extensionFields,
          "metadata.json": `~~~json\n${JSON.stringify(metadata)}\n~~~`,
        }),
        [],
      )?.passed,
    ).toBe(true);
  });

  test("validates HTTPS and GNOME listing URL syntax without network requests", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://example.org",
      "https://user:pass@example.org",
      "https://localhost",
      "https://127.0.0.1",
      "https://[::1]",
      "https://example.local",
      "https://example.org:8080",
      "https://example.org/has spaces",
    ])
      expect(isPublicHttpsUrl(url)).toBe(false);
    expect(isPublicHttpsUrl("https://gitlab.gnome.org/example/project")).toBe(
      true,
    );
    for (const url of [
      "https://extensions.gnome.org.attacker.org/extension/1/test",
      "https://extensions.gnome.org/",
      "https://extensions.gnome.org/extension/not-an-id",
    ])
      expect(
        reviewListing(
          "[Submit] Example",
          body({ ...extensionFields, "GNOME Extensions listing": url }),
          [],
        )?.passed,
      ).toBe(false);
    expect(
      reviewListing(
        "[Submit] Example",
        body({
          ...extensionFields,
          "GNOME Extensions listing":
            "https://extensions.gnome.org/extension/123/example/",
        }),
        [],
      )?.passed,
    ).toBe(true);
  });

  test("the example fixtures and current form field labels stay usable", () => {
    for (const kind of ["app", "extension"]) {
      const fixture = JSON.parse(
        readFileSync(`examples/listing-review/${kind}.json`, "utf8"),
      ) as { title: string; body: string };
      expect(reviewListing(fixture.title, fixture.body, [])?.passed).toBe(true);
      const fields = parseIssueFields(fixture.body).fields;
      const form = Bun.YAML.parse(
        readFileSync(`.github/ISSUE_TEMPLATE/submit-${kind}.yml`, "utf8"),
      ) as {
        body: {
          attributes: { label?: string };
          validations?: { required?: boolean };
        }[];
      };
      for (const field of form.body.filter(
        (field) => field.validations?.required,
      ))
        expect(fields.has(field.attributes.label?.toLowerCase() ?? "")).toBe(
          true,
        );
    }
  });
});

function fakeGitHub() {
  const issue = {
    number: 1,
    title: "[App] Example",
    body: body(appFields),
    state: "open",
    labels: [{ name: "unrelated" }],
  };
  const comments: {
    id: number;
    body: string;
    user: { login: string; type: string };
  }[] = [];
  const mutations: string[] = [];
  let permission = "write";
  const request: GitHubRequest = async <T>(
    path: string,
    method = "GET",
    payload?: unknown,
  ): Promise<T> => {
    if (method !== "GET") mutations.push(`${method} ${path}`);
    const data = payload as { body?: string; labels?: string[] };
    let result: unknown;
    if (path.includes("/permission")) result = { permission };
    else if (path === "/issues/1" && method === "GET")
      result = structuredClone(issue);
    else if (path.startsWith("/labels/") && method === "GET")
      result = { name: decodeURIComponent(path.slice(8)) };
    else if (path.startsWith("/issues/1/comments?") && method === "GET") {
      const page = Number(
        new URL(`https://example.org${path}`).searchParams.get("page"),
      );
      result = structuredClone(comments.slice((page - 1) * 100, page * 100));
    } else if (path === "/issues/1/comments" && method === "POST") {
      const comment = {
        id: comments.length + 1,
        body: data.body ?? "",
        user: { login: "github-actions[bot]", type: "Bot" },
      };
      comments.push(comment);
      result = comment;
    } else if (path.startsWith("/issues/comments/") && method === "PATCH") {
      const comment = comments.find(
        (entry) => entry.id === Number(path.split("/").at(-1)),
      );
      if (!comment) throw new Error("Missing report");
      comment.body = data.body ?? "";
      result = comment;
    } else if (path.startsWith("/issues/1/labels/") && method === "DELETE") {
      issue.labels = issue.labels.filter(
        (label) =>
          label.name !== decodeURIComponent(path.split("/").at(-1) ?? ""),
      );
    } else if (path === "/issues/1/labels" && method === "POST") {
      issue.labels = [
        ...issue.labels.filter((label) => !data.labels?.includes(label.name)),
        ...(data.labels ?? []).map((name) => ({ name })),
      ];
      result = issue.labels;
    } else throw new Error(`Unexpected request: ${method} ${path}`);
    return result as T;
  };
  return {
    issue,
    comments,
    mutations,
    request,
    setPermission(value: string) {
      permission = value;
    },
    event(): ReviewEvent {
      return { action: "opened", issue: structuredClone(issue) };
    },
    confirmation(fingerprint = listingFingerprint(issue)): ReviewEvent {
      return {
        action: "created",
        issue: structuredClone(issue),
        comment: {
          id: 999,
          body: `/confirm-listing ${fingerprint}`,
          user: { login: "maintainer", type: "User" },
        },
      };
    },
  };
}

describe("automated checks then human confirmation", () => {
  test("passing checks wait for a human and update one bot report", async () => {
    const api = fakeGitHub();
    await runListingReview(api.event(), api.request, []);
    expect(api.issue.labels.map((label) => label.name)).toEqual([
      "unrelated",
      reviewLabels.pending,
    ]);
    expect(api.comments).toHaveLength(1);
    expect(api.comments[0]?.body).toContain(
      `/confirm-listing ${listingFingerprint(api.issue)}`,
    );
    await runListingReview(api.confirmation(), api.request, []);
    expect(api.issue.labels.map((label) => label.name)).toEqual([
      "unrelated",
      reviewLabels.confirmed,
    ]);
    expect(api.comments).toHaveLength(1);
    expect(api.comments[0]?.body).toContain(
      "Human confirmation recorded from maintainer",
    );
    expect(api.mutations.every((path) => path.includes("/issues/"))).toBe(true);
  });

  test("a fresh confirmation cannot precede the passing basic report", async () => {
    const api = fakeGitHub();
    expect(
      await runListingReview(api.confirmation(), api.request, []),
    ).toContain("Confirmation refused");
    expect(api.mutations).toHaveLength(0);
  });

  test("denies read/triage permissions, bots, edited comments, and malformed commands", async () => {
    const api = fakeGitHub();
    await runListingReview(api.event(), api.request, []);
    api.mutations.length = 0;
    api.setPermission("read");
    expect(
      await runListingReview(api.confirmation(), api.request, []),
    ).toContain("write access");
    api.setPermission("write");
    const event = api.confirmation();
    if (!event.comment) throw new Error("Missing comment");
    event.comment.user.type = "Bot";
    expect(await runListingReview(event, api.request, [])).toContain("Skipped");
    event.comment.user.type = "User";
    event.action = "edited";
    expect(await runListingReview(event, api.request, [])).toContain("Skipped");
    event.action = "created";
    event.comment.body = "/confirm-listing";
    expect(await runListingReview(event, api.request, [])).toContain("Skipped");
    expect(api.mutations).toHaveLength(0);
  });

  test("live edits invalidate old commands and remove confirmation", async () => {
    const api = fakeGitHub();
    await runListingReview(api.event(), api.request, []);
    await runListingReview(api.confirmation(), api.request, []);
    const stale = api.confirmation();
    api.issue.body = body({ ...appFields, Summary: "An updated summary." });
    expect(await runListingReview(stale, api.request, [])).toContain(
      "Confirmation refused",
    );
    await runListingReview(
      { ...api.event(), action: "edited" },
      api.request,
      [],
    );
    expect(api.issue.labels.map((label) => label.name)).toContain(
      reviewLabels.pending,
    );
    expect(api.issue.labels.map((label) => label.name)).not.toContain(
      reviewLabels.confirmed,
    );
    await runListingReview(api.confirmation(), api.request, []);
    expect(api.issue.labels.map((label) => label.name)).toContain(
      reviewLabels.confirmed,
    );
  });

  test("missing fields or removing the form clear existing confirmation", async () => {
    const api = fakeGitHub();
    await runListingReview(api.event(), api.request, []);
    await runListingReview(api.confirmation(), api.request, []);
    api.issue.body = body({ ...appFields, "Author and license": "" });
    await runListingReview(api.event(), api.request, []);
    expect(api.issue.labels.map((label) => label.name)).toEqual([
      "unrelated",
      reviewLabels.changes,
    ]);
    expect(api.comments[0]?.body).toContain("checks:failed");
    expect(
      await runListingReview(api.confirmation(), api.request, []),
    ).toContain("Confirmation refused");
    api.issue.title = "Changed title";
    api.issue.body = "Removed all form fields";
    await runListingReview(api.event(), api.request, []);
    expect(api.comments[0]?.body).toContain(
      "Restore the app or extension submission fields",
    );
  });

  test("does not trust user-spoofed reports and paginates to find the bot report", async () => {
    const api = fakeGitHub();
    const fakeReport = renderReview(
      reviewListing(api.issue.title, api.issue.body, []),
      listingFingerprint(api.issue),
    );
    for (let id = 1; id <= 100; id++)
      api.comments.push({
        id,
        body: fakeReport,
        user: { login: "submitter", type: "User" },
      });
    expect(
      await runListingReview(api.confirmation(), api.request, []),
    ).toContain("Confirmation refused");
    await runListingReview(api.event(), api.request, []);
    await runListingReview(api.confirmation(), api.request, []);
    expect(api.comments).toHaveLength(101);
    expect(api.comments[100]?.body).toContain("Human confirmation recorded");
    expect(api.comments[0]?.body).toBe(fakeReport);
  });

  test("skips closed issues and pull requests, and fails closed on API errors", async () => {
    const api = fakeGitHub();
    api.issue.state = "closed";
    expect(await runListingReview(api.event(), api.request, [])).toContain(
      "Skipped",
    );
    const event = api.event();
    if (!event.issue) throw new Error("Missing issue");
    event.issue.pull_request = {};
    expect(await runListingReview(event, api.request, [])).toContain("Skipped");
    expect(api.mutations).toHaveLength(0);
    await expect(
      runListingReview(api.confirmation(), async () => {
        throw new Error("GitHub unavailable");
      }, []),
    ).rejects.toThrow("GitHub unavailable");
  });

  test("escapes mentions, report markers, and markup in submitted values", () => {
    const review = reviewListing(
      "[App] Example",
      body({
        ...appFields,
        Summary:
          "@everyone <script>bad</script> <!-- submission:fake checks:passed --> [link](https://example.org)",
      }),
      [],
    );
    const report = renderReview(review, "abc");
    expect(report).not.toContain("@everyone");
    expect(report).not.toContain("<script>");
    expect(report).not.toContain("<!-- submission:fake");
    expect(report).not.toContain("[link](https://example.org)");
    expect(report).toContain("&#64;everyone");
    expect(report).not.toContain("&\\#64;");
  });
});

test("workflow handles issue edits and confirmations using trusted code and limited permissions", () => {
  const workflow = Bun.YAML.parse(
    readFileSync(".github/workflows/listing-review.yml", "utf8"),
  ) as {
    on: { issues: { types: string[] }; issue_comment: { types: string[] } };
    permissions: Record<string, string>;
    concurrency: { group: string; "cancel-in-progress": boolean };
    jobs: {
      review: {
        if: string;
        steps: {
          uses?: string;
          run?: string;
          with?: Record<string, unknown>;
        }[];
      };
    };
  };
  expect(workflow.on.issues.types).toEqual(["opened", "edited", "reopened"]);
  expect(workflow.on.issue_comment.types).toEqual(["created"]);
  expect(workflow.permissions).toEqual({ contents: "read", issues: "write" });
  expect(workflow.concurrency.group).toContain("github.event.issue.number");
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  expect(workflow.jobs.review.if).toContain("!github.event.issue.pull_request");
  const steps = workflow.jobs.review.steps;
  const checkout = steps.find((step) =>
    step.uses?.startsWith("actions/checkout@"),
  );
  expect(checkout?.with).toEqual({
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not JavaScript interpolation.
    ref: "${{ github.event.repository.default_branch }}",
    "persist-credentials": false,
  });
  for (const step of steps.filter((step) => step.uses))
    expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
  expect(steps.filter((step) => step.run).map((step) => step.run)).toEqual([
    "bun scripts/listing-review.ts --github",
  ]);
});
