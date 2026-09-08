import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ExtensionIdentity } from "../app/lib/extension-identity";
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
  runListingReview as runListingReviewWithRepository,
} from "../scripts/listing-review";

const appIdentity = {
  appId: "org.example.App",
  repository: "https://github.com/example/app",
  commit: "a".repeat(40),
  path: "data/org.example.App.metainfo.xml",
};
const runListingReview: typeof runListingReviewWithRepository = (
  event,
  request,
  entries,
  resolve = async () => appIdentity,
  resolveExtension = async () => extensionIdentity,
) =>
  runListingReviewWithRepository(
    event,
    request,
    entries,
    resolve,
    resolveExtension,
  );

const metadata = {
  uuid: "example@example.org",
  name: "Example Extension",
  description: "A focused desktop extension.",
  "shell-version": ["3.38", "45", "50"],
};
const extensionIdentity = {
  metadata,
  repository: "https://github.com/example/extension",
  commit: "b".repeat(40),
  path: "metadata.json",
};
const appFields = {
  "App name": "Example App",
  "Repository or project URL": "https://github.com/example/app",
  Summary: "A focused desktop app.",
};
const extensionFields = {
  "Extension name": metadata.name,
  "Source repository": "https://github.com/example/extension",
  Summary: metadata.description,
};
const body = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([name, value]) => `### ${name}\n\n${value}`)
    .join("\n\n");
const extensionReview = (changes: Record<string, unknown>) =>
  reviewListing("[Submit] Example", body(extensionFields), [], {
    ...extensionIdentity,
    metadata: { ...metadata, ...changes } as ExtensionIdentity["metadata"],
  });

describe("basic listing checks", () => {
  test("app identity is automatic even when an older issue contains a manual Listing ID", () => {
    expect(
      reviewListing(
        "[App] Example",
        body({ ...appFields, "Listing ID": "IGNORED-manual-id" }),
        [],
      )?.passed,
    ).toBe(true);
  });
  test("ignores removed fields in new extension submissions", () => {
    expect(
      reviewListing(
        "",
        body({
          ...extensionFields,
          "Listing ID": "../ignored",
          "Extension UUID": "ignored@example.org",
          "metadata.json": "{invalid submitted metadata}",
          "GNOME Extensions listing": "javascript:alert(1)",
          "Your relationship to the extension": "_No response_",
        }),
        [],
        extensionIdentity,
      )?.passed,
    ).toBe(true);
  });

  test("accepts complete app submissions and the official minimal extension metadata", () => {
    expect(reviewListing("[App] Example", body(appFields), [])?.passed).toBe(
      true,
    );
    expect(
      reviewListing(
        "[Submit] Example",
        body(extensionFields),
        [],
        extensionIdentity,
      )?.passed,
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
      reviewListing(
        "[Submit] Example",
        body(extensionFields),
        catalog,
        extensionIdentity,
      )?.passed,
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

  test("validates HTTPS and legacy update GNOME listing URLs without network requests", () => {
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
    const update = {
      ...extensionFields,
      "Extension UUID": metadata.uuid,
      "Requested changes": "Correct the GNOME listing URL.",
      "Your relationship to the extension": "Author",
    };
    for (const url of [
      "https://extensions.gnome.org.attacker.org/extension/1/test",
      "https://extensions.gnome.org/",
      "https://extensions.gnome.org/extension/not-an-id",
    ])
      expect(
        reviewListing(
          "[Update] Example",
          body({ ...update, "GNOME Extensions listing": url }),
          [{ metadata }],
        )?.passed,
      ).toBe(false);
    expect(
      reviewListing(
        "[Update] Example",
        body({
          ...update,
          "GNOME Extensions listing":
            "https://extensions.gnome.org/extension/123/example/",
        }),
        [{ metadata }],
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
    confirmation(
      fingerprint = listingFingerprint(issue, appIdentity),
    ): ReviewEvent {
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
  test("extension review detects the UUID and binds confirmation to repository metadata", async () => {
    const api = fakeGitHub();
    api.issue.title = "[Submit] Example";
    api.issue.body = body(extensionFields);
    const report = await runListingReview(api.event(), api.request, []);
    const fingerprint = listingFingerprint(api.issue, extensionIdentity);
    expect(report).toContain(`Extension UUID: \`${metadata.uuid}\``);
    expect(report).toContain(`/blob/${extensionIdentity.commit}/metadata.json`);
    expect(report).toContain(`/publish-listing ${fingerprint}`);
    expect(
      await runListingReview(
        api.confirmation(fingerprint),
        api.request,
        [],
        undefined,
        async () => ({ ...extensionIdentity, commit: "c".repeat(40) }),
      ),
    ).toContain("Confirmation refused");
    expect(
      await runListingReview(api.confirmation(fingerprint), api.request, []),
    ).toContain("Human confirmation recorded");
  });

  test("extension discovery errors and invalid repository metadata block approval", async () => {
    const api = fakeGitHub();
    api.issue.title = "[Submit] Example";
    api.issue.body = body(extensionFields);
    for (const resolve of [
      async () => {
        throw new Error("No metadata.json");
      },
      async () => ({
        ...extensionIdentity,
        metadata: { ...metadata, "shell-version": [] },
      }),
    ]) {
      const report = await runListingReview(
        api.event(),
        api.request,
        [],
        undefined,
        resolve,
      );
      expect(report).toContain("checks:failed");
      expect(report).not.toContain("/publish-listing");
      expect(api.issue.labels.map((label) => label.name)).toContain(
        reviewLabels.changes,
      );
    }
    const offline = renderReview(
      reviewListing(api.issue.title, api.issue.body, []),
      listingFingerprint(api.issue),
    );
    expect(offline).not.toContain("/publish-listing");
  });
  test("manual reruns read live issue content and generate a fresh repository identity report", async () => {
    const api = fakeGitHub();
    const report = await runListingReview(
      { inputs: { issue_number: "1" } },
      api.request,
      [],
    );
    expect(report).toContain("App ID: `org.example.App`");
    expect(report).toContain(
      `/publish-listing ${listingFingerprint(api.issue, appIdentity)}`,
    );
    expect(api.issue.labels.map((label) => label.name)).toContain(
      reviewLabels.pending,
    );
  });

  test("manual reruns reject invalid issue numbers before any GitHub request", async () => {
    for (const number of [
      undefined,
      1,
      "0",
      "01",
      "-1",
      "1/labels",
      "1; echo nope",
      "999999999999999999",
    ]) {
      let calls = 0;
      await expect(
        runListingReview({ inputs: { issue_number: number } }, async () => {
          calls++;
          throw new Error("Unexpected request");
        }, []),
      ).rejects.toThrow("positive issue number");
      expect(calls).toBe(0);
    }
  });
  test("repository lookup failures request information instead of issuing an approval command", async () => {
    const api = fakeGitHub();
    const report = await runListingReview(
      api.event(),
      api.request,
      [],
      async () => {
        throw new Error("No app ID found.");
      },
    );
    expect(report).toContain("checks:failed");
    expect(report).toContain("No app ID found");
    expect(report).not.toContain("/publish-listing");
    expect(api.issue.labels.map((label) => label.name)).toContain(
      reviewLabels.changes,
    );
  });

  test("reports the detected identity and invalidates approval after an upstream revision changes", async () => {
    const api = fakeGitHub();
    const report = await runListingReview(api.event(), api.request, []);
    expect(report).toContain("App ID: `org.example.App`");
    expect(report).toContain(`/blob/${appIdentity.commit}/${appIdentity.path}`);
    expect(
      await runListingReview(api.confirmation(), api.request, [], async () => ({
        ...appIdentity,
        commit: "b".repeat(40),
      })),
    ).toContain("Confirmation refused");
    expect(api.issue.labels.map((label) => label.name)).not.toContain(
      reviewLabels.confirmed,
    );
  });

  test("passing checks wait for a human and update one bot report", async () => {
    const api = fakeGitHub();
    await runListingReview(api.event(), api.request, []);
    expect(api.issue.labels.map((label) => label.name)).toEqual([
      "unrelated",
      reviewLabels.pending,
    ]);
    expect(api.comments).toHaveLength(1);
    expect(api.comments[0]?.body).toContain(
      `/publish-listing ${listingFingerprint(api.issue, appIdentity)}`,
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
    expect(api.comments[0]?.body).toContain(
      "Publication runs after confirmation",
    );
    expect(api.comments[0]?.body).toContain(
      `/publish-listing ${listingFingerprint(api.issue, appIdentity)}`,
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
    api.issue.body = body({ ...appFields, Summary: "" });
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
      listingFingerprint(api.issue, appIdentity),
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
    on: {
      issues: { types: string[] };
      issue_comment: { types: string[] };
      workflow_dispatch: {
        inputs: { issue_number: { required: boolean; type: string } };
      };
    };
    permissions: Record<string, string>;
    jobs: {
      review: {
        if: string;
        concurrency: { group: string; "cancel-in-progress": boolean };
        steps: {
          uses?: string;
          run?: string;
          with?: Record<string, unknown>;
          if?: string;
          env?: Record<string, string>;
        }[];
      };
    };
  };
  expect(workflow.on.issues.types).toEqual(["opened", "edited", "reopened"]);
  expect(workflow.on.issue_comment.types).toEqual(["created"]);
  expect(workflow.on.workflow_dispatch.inputs.issue_number).toMatchObject({
    required: true,
    type: "string",
  });
  expect(workflow.permissions).toEqual({ contents: "read", issues: "write" });
  expect(workflow.jobs.review.concurrency.group).toContain(
    "github.event.issue.number",
  );
  expect(workflow.jobs.review.concurrency["cancel-in-progress"]).toBe(false);
  expect(workflow.jobs.review.if).toContain("!github.event.issue.pull_request");
  expect(workflow.jobs.review.if).toContain(
    "github.event_name == 'workflow_dispatch'",
  );
  expect(workflow.jobs.review.if).toContain(
    "github.event.repository.default_branch",
  );
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
    "bun test tests/app-identity.test.ts tests/extension-identity.test.ts tests/listing-review.test.ts",
    "bun test tests/extension-submission-workflow.test.ts",
    "bun test tests/catalog-publication.test.ts tests/app-identity-migration.test.ts tests/listing-ids.test.ts",
    "bun scripts/listing-review.ts --github",
    "bun scripts/publish-listing.ts",
  ]);
  const publishing = steps.at(-1);
  expect(publishing?.if).toContain("github.event_name == 'issue_comment'");
  expect(publishing?.if).toContain("github.event.comment.user.type == 'User'");
  expect(publishing?.if).toContain("/confirm-listing ");
  expect(publishing?.env?.CLOUDFLARE_API_TOKEN).toBeDefined();
  for (const step of steps.slice(0, -1))
    expect(step.env?.CLOUDFLARE_API_TOKEN).toBeUndefined();
});
