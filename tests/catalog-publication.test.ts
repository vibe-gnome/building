import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import seed from "../app/data/extensions.json";
import type { AppIdentity } from "../app/lib/app-identity";
import type { ExtensionIdentity } from "../app/lib/extension-identity";
import { parseAudits } from "../scripts/check-skill-audits";
import {
  type GitHubRequest,
  listingFingerprint,
} from "../scripts/listing-review";
import {
  type PublishEvent,
  publishListing as publishListingWithRepository,
  publishSql,
  resolvePublishEvent,
} from "../scripts/publish-listing";
import { catalogDatabase } from "./helpers/catalog-db";

const appIdentity = {
  appId: "org.example.Editor",
  repository: "https://github.com/example/editor",
  commit: "a".repeat(40),
  path: "data/org.example.Editor.metainfo.xml",
};
const extensionIdentity = {
  repository: "https://github.com/example/extension",
  commit: "b".repeat(40),
  path: "metadata.json",
  metadata: {
    uuid: "example@example.org",
    name: "Example Extension",
    description: "A focused extension",
    "shell-version": ["50"],
  },
};
const extensionFields = {
  "Extension name": extensionIdentity.metadata.name,
  "Source repository": extensionIdentity.repository,
  Summary: extensionIdentity.metadata.description,
};
const publishListing: typeof publishListingWithRepository = (
  event,
  github,
  query,
  audits,
  resolve = async () => appIdentity,
  resolveExtension = async () => extensionIdentity,
) =>
  publishListingWithRepository(
    event,
    github,
    query,
    audits,
    resolve,
    resolveExtension,
  );

const databases: ReturnType<typeof catalogDatabase>[] = [];
afterEach(() => {
  for (const value of databases.splice(0)) value.db.close();
});
const fields = (value: Record<string, string>) =>
  Object.entries(value)
    .map(([label, text]) => `### ${label}\n\n${text}`)
    .join("\n\n");
const appFields = {
  "App name": "Editor's app",
  "Repository or project URL": "https://github.com/example/editor",
  Summary: "A GTK app",
};
const skillFields = {
  "Skill name": "GTK",
  "skills.sh URL": "https://skills.sh/vercel-labs/skills/find-skills",
  "Source repository URL": "https://github.com/vercel-labs/skills",
  "SKILL.md permalink":
    "https://github.com/vercel-labs/skills/blob/0123456789abcdef0123456789abcdef01234567/skills/find-skills/SKILL.md",
  Summary: "GTK guidance",
  "Installation and usage": "Read the guide",
  "Author and license": "Maintainer / MIT",
  "Your relationship to the skill": "Author",
  "Permissions and external services": "None",
};
const html = await Bun.file(
  new URL("./fixtures/skill-audits.html", import.meta.url),
).text();

test("review and publication jobs share issue locks and validate trusted code before using credentials", () => {
  type Step = {
    uses?: string;
    run?: string;
    with?: Record<string, unknown>;
    env?: Record<string, string>;
  };
  type Workflow = {
    on: { issue_comment?: { types: string[] } };
    permissions: Record<string, string>;
    concurrency?: unknown;
    jobs: Record<
      string,
      {
        if: string;
        concurrency: { group: string; "cancel-in-progress": boolean };
        steps: Step[];
      }
    >;
  };
  const read = (name: string) =>
    Bun.YAML.parse(
      readFileSync(`.github/workflows/${name}.yml`, "utf8"),
    ) as Workflow;
  const publishing = read("publish-listing");
  const publish = publishing.jobs.publish;
  if (!publish) throw new Error("Missing publication job");
  expect(publishing.on.issue_comment?.types).toEqual(["created"]);
  expect(publishing.permissions).toEqual({ contents: "read", issues: "read" });
  expect(publish.if).toContain("github.event.comment.user.type == 'User'");
  expect(publish.if).toContain("/publish-listing ");
  for (const [name, job] of [
    ["listing-review", "review"],
    ["review-skill", "security-audits"],
    ["publish-listing", "publish"],
  ]) {
    const workflow = read(name ?? "");
    const definition = workflow.jobs[job ?? ""];
    if (!definition) throw new Error("Missing listing job");
    expect(workflow.concurrency).toBeUndefined();
    expect(
      definition.concurrency.group.replace(" || inputs.issue_number", ""),
    ).toBe(publish.concurrency.group.replace(" || inputs.issue_number", ""));
    expect(definition.concurrency["cancel-in-progress"]).toBe(false);
    const checkout = definition.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
    expect(checkout?.with?.ref).toContain(
      "github.event.repository.default_branch",
    );
    expect(
      definition.steps.find((step) =>
        step.uses?.startsWith("oven-sh/setup-bun@"),
      )?.with?.["bun-version"],
    ).toBe("1.3.14");
    for (const step of definition.steps.filter((step) => step.uses))
      expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
  }
  const checks = publish.steps.findIndex((step) =>
    step.run?.startsWith("bun test "),
  );
  const write = publish.steps.findIndex(
    (step) => step.run === "bun scripts/publish-listing.ts",
  );
  expect(checks).toBeGreaterThan(-1);
  expect(write).toBeGreaterThan(checks);
  expect(publish.steps[checks]?.run).toContain(
    "tests/app-identity-migration.test.ts",
  );
  const formCheck = publish.steps.findIndex(
    (step) =>
      step.run === "bun test tests/extension-submission-workflow.test.ts",
  );
  expect(formCheck).toBeGreaterThan(-1);
  expect(formCheck).toBeLessThan(write);
  for (const step of publish.steps.slice(0, write))
    expect(step.env?.CLOUDFLARE_API_TOKEN).toBeUndefined();
});

function setup(
  title = "[App] Editor",
  values = appFields as Record<string, string>,
  identity?: AppIdentity | ExtensionIdentity,
) {
  const data = catalogDatabase();
  databases.push(data);
  const issue = { number: 42, title, body: fields(values), state: "open" };
  const fingerprint = listingFingerprint(
    issue,
    identity ??
      (values["App name"]
        ? appIdentity
        : values["Extension name"] && !values["Requested changes"]
          ? extensionIdentity
          : undefined),
  );
  const event: PublishEvent = {
    action: "created",
    issue,
    comment: {
      id: 999,
      body: `/publish-listing ${fingerprint}`,
      user: { login: "maintainer", type: "User" },
    },
  };
  const state = {
    permission: "write",
    report: true,
    bot: true,
    issueReads: 0,
    changeOnFinal: false,
  };
  const github: GitHubRequest = async <T>(path: string): Promise<T> => {
    if (path.endsWith("/permission"))
      return { permission: state.permission } as T;
    if (path === "/issues/42") {
      state.issueReads++;
      return {
        ...issue,
        body:
          issue.body +
          (state.changeOnFinal && state.issueReads > 1 ? "\nEdited" : ""),
      } as T;
    }
    if (path.includes("/comments?"))
      return (
        state.report
          ? [
              {
                user: {
                  login: state.bot ? "github-actions[bot]" : "submitter",
                  type: state.bot ? "Bot" : "User",
                },
                body: `${values["Skill name"] ? "<!-- vibe-gnome:skill-audits -->" : "<!-- vibe-gnome-listing-review -->"}\n<!-- submission:${fingerprint} checks:passed -->`,
              },
            ]
          : []
      ) as T;
    throw new Error(`Unexpected request: ${path}`);
  };
  return { ...data, event, github, state, issue };
}

describe("human-approved database publication", () => {
  test.each(["apps", "extensions"] as const)(
    "publishes the reviewed social preview for %s and rejects changed previews",
    async (category) => {
      const screenshot =
        "https://repository-images.githubusercontent.com/12345/reviewed-preview.png";
      const identity = {
        ...(category === "apps" ? appIdentity : extensionIdentity),
        screenshot,
      };
      const data = setup(
        category === "apps" ? "[App] Editor" : "[Submit] Example",
        category === "apps" ? appFields : extensionFields,
        identity,
      );
      const publish = (image: string | undefined) =>
        publishListing(
          data.event,
          data.github,
          data.query,
          undefined,
          async () => ({ ...appIdentity, screenshot: image }),
          async () => ({ ...extensionIdentity, screenshot: image }),
        );
      await expect(
        publish(
          "https://repository-images.githubusercontent.com/12345/changed-preview.png",
        ),
      ).rejects.toThrow("revision changed");
      await expect(publish(undefined)).rejects.toThrow("revision changed");
      await publish(screenshot);
      const entry = await data.catalog.getById(category, 3);
      expect(entry?.screenshot).toBe(screenshot);
      const row = (
        await data.query(
          "SELECT evidence, payload FROM listing_reviews WHERE source_issue = 42",
        )
      ).results[0];
      expect(JSON.parse(String(row?.payload)).screenshot).toBe(screenshot);
      expect(
        JSON.parse(String(row?.evidence))[
          category === "apps" ? "appIdentity" : "extensionIdentity"
        ].screenshot,
      ).toBe(screenshot);
    },
  );
  test("publishes a confirmed extension using the original human approval comment", async () => {
    const data = setup("[Submit] Example", extensionFields);
    data.event.comment.body = data.event.comment.body.replace(
      "/publish-listing",
      "/confirm-listing",
    );
    const github: GitHubRequest = async <T>(
      path: string,
      method: Parameters<GitHubRequest>[1],
      body: unknown,
    ): Promise<T> => {
      if (path === "/issues/comments/999")
        return {
          ...data.event.comment,
          issue_url:
            "https://api.github.com/repos/vibe-gnome/building/issues/42",
          created_at: "2026-09-08T04:30:16Z",
          updated_at: "2026-09-08T04:30:16Z",
        } as T;
      return data.github<T>(path, method, body);
    };
    const event = await resolvePublishEvent(
      { inputs: { issue_number: "42", approval_comment_id: "999" } },
      github,
      "vibe-gnome/building",
    );
    await publishListing(event, github, data.query);
    expect(
      (await data.catalog.get("extensions", "submission-42"))?.metadata,
    ).toEqual(extensionIdentity.metadata);
  });

  test("manual publication rejects missing or malformed IDs before fetching", async () => {
    const github: GitHubRequest = async () => {
      throw new Error("Unexpected request");
    };
    for (const value of [undefined, "", "0", "01", "-1", "1/2", "1e3", 42]) {
      for (const inputs of [
        { issue_number: value, approval_comment_id: "999" },
        { issue_number: "42", approval_comment_id: value },
      ])
        await expect(
          resolvePublishEvent({ inputs }, github, "vibe-gnome/building"),
        ).rejects.toThrow("positive issue");
    }
  });

  test("manual publication rejects edited approvals and comments from another issue", async () => {
    const data = setup();
    for (const change of [
      { updated_at: "2026-09-08T04:31:00Z" },
      {
        issue_url: "https://api.github.com/repos/vibe-gnome/building/issues/41",
      },
      { issue_url: "https://api.github.com/repos/other/repo/issues/42" },
      { id: 1000 },
    ]) {
      const github: GitHubRequest = async <T>(): Promise<T> =>
        ({
          ...data.event.comment,
          issue_url:
            "https://api.github.com/repos/vibe-gnome/building/issues/42",
          created_at: "2026-09-08T04:30:16Z",
          updated_at: "2026-09-08T04:30:16Z",
          ...change,
        }) as T;
      await expect(
        resolvePublishEvent(
          { inputs: { issue_number: "42", approval_comment_id: "999" } },
          github,
          "vibe-gnome/building",
        ),
      ).rejects.toThrow("unedited comment");
    }
  });

  test("confirmation publication still requires current human permissions and passing checks", async () => {
    for (const failure of ["read", "bot", "stale", "no report"]) {
      const data = setup("[Submit] Example", extensionFields);
      data.event.comment.body = data.event.comment.body.replace(
        "/publish-listing",
        "/confirm-listing",
      );
      if (failure === "read") data.state.permission = "read";
      if (failure === "bot") data.event.comment.user.type = "Bot";
      if (failure === "stale") data.issue.body += "\nEdited";
      if (failure === "no report") data.state.report = false;
      await expect(
        publishListing(data.event, data.github, data.query),
      ).rejects.toThrow();
      expect(await data.catalog.get("extensions", "submission-42")).toBeNull();
    }
  });
  test("all publication categories require automatic database ID assignment", async () => {
    for (const [title, values] of [
      ["[App] Editor", appFields],
      ["[Skill] GTK", skillFields],
      ["[Submit] Example", extensionFields],
    ] as const) {
      const data = setup(title, values);
      data.db.exec("DROP TRIGGER listings_assign_db_id");
      await expect(
        publishListing(data.event, data.github, data.query),
      ).rejects.toThrow("0005_listing_ids.sql");
      expect(
        data.db
          .query("SELECT * FROM listing_reviews WHERE source_issue = 42")
          .all(),
      ).toHaveLength(0);
    }
  });

  test("new extensions use repository metadata and return the numeric URL, ignoring old manual fields", async () => {
    const data = setup("[Submit] Example", {
      ...extensionFields,
      "Listing ID": "../ignored",
      "Extension UUID": "ignored@example.org",
      "metadata.json": "{invalid submitted data}",
      "GNOME Extensions listing": "javascript:alert(1)",
      "Your relationship to the extension": "_No response_",
    });
    const result = await publishListing(data.event, data.github, data.query);
    expect(result).toContain("https://vibe-gnome.org/extensions/3/example");
    expect((await data.catalog.getById("extensions", 3))?.metadata).toEqual(
      extensionIdentity.metadata,
    );
    expect(
      (await data.catalog.getById("extensions", 3))?.gnomeUrl,
    ).toBeUndefined();
    const row = data.db
      .query<{ evidence: string }, []>(
        "SELECT evidence FROM listing_reviews WHERE source_issue = 42",
      )
      .get();
    expect(JSON.parse(row?.evidence ?? "{}").extensionIdentity).toEqual(
      extensionIdentity,
    );
    expect(await publishListing(data.event, data.github, data.query)).toContain(
      "already been published",
    );
  });

  test("extension publication rejects changed revisions, discovery failures, invalid metadata, and duplicate UUIDs", async () => {
    const data = setup("[Submit] Example", extensionFields);
    await expect(
      publishListing(
        data.event,
        data.github,
        data.query,
        undefined,
        undefined,
        async () => {
          throw new Error("No metadata.json");
        },
      ),
    ).rejects.toThrow("No metadata.json");
    await expect(
      publishListing(
        data.event,
        data.github,
        data.query,
        undefined,
        undefined,
        async () => ({ ...extensionIdentity, commit: "c".repeat(40) }),
      ),
    ).rejects.toThrow("revision changed");
    await expect(
      publishListing(
        data.event,
        data.github,
        data.query,
        undefined,
        undefined,
        async () => ({
          ...extensionIdentity,
          icon: `https://raw.githubusercontent.com/example/extension/${extensionIdentity.commit}/icon.svg`,
        }),
      ),
    ).rejects.toThrow("revision changed");
    await expect(
      publishListing(
        data.event,
        data.github,
        data.query,
        undefined,
        undefined,
        async () => ({
          ...extensionIdentity,
          metadata: { ...extensionIdentity.metadata, "shell-version": [] },
        }),
      ),
    ).rejects.toThrow("validation failed");
    const original = seed[0];
    if (!original) throw new Error("Missing fixture");
    data.insert("extensions", {
      ...original,
      slug: "existing-example",
      metadata: extensionIdentity.metadata,
    });
    await expect(
      publishListing(data.event, data.github, data.query),
    ).rejects.toThrow("validation failed");
    expect(
      data.db
        .query("SELECT * FROM listing_reviews WHERE source_issue = 42")
        .all(),
    ).toHaveLength(0);
  });

  test("republishing skills preserves an older manual key, its DB ID, and its views", async () => {
    const data = setup("[Skill] GTK", {
      ...skillFields,
      "Listing ID": "ignored-new-value",
    });
    data.insert("skills", {
      id: "legacy-skill",
      name: "Old name",
      href: skillFields["skills.sh URL"],
      description: "Old summary",
    });
    await data.query(
      "UPDATE listings SET source_issue = 42, revision = 'assign-issue' WHERE category = 'skills'",
    );
    await data.views.increment("skills", "legacy-skill");
    expect(
      await publishListing(data.event, data.github, data.query, async () =>
        parseAudits(html, skillFields["skills.sh URL"]),
      ),
    ).toContain("https://vibe-gnome.org/skills/3/find-skills");
    expect((await data.catalog.getById("skills", 3))?.id).toBe("legacy-skill");
    expect(await data.views.read("skills", "legacy-skill")).toBe(1);
  });
  test("app publication requires the identity migration before writing data", async () => {
    const data = setup();
    data.db.exec("DROP INDEX listings_app_id");
    await expect(
      publishListing(data.event, data.github, data.query),
    ).rejects.toThrow("0004_app_identity.sql");
    expect(await data.catalog.list("apps")).toEqual([]);
  });
  test("publishes an app with its approval history atomically and retries without duplicate writes", async () => {
    const data = setup();
    expect(await publishListing(data.event, data.github, data.query)).toContain(
      "https://vibe-gnome.org/apps/3/editor",
    );
    expect((await data.catalog.get("apps", "org-example-editor"))?.name).toBe(
      "Editor's app",
    );
    expect((await data.catalog.get("apps", "org-example-editor"))?.appId).toBe(
      appIdentity.appId,
    );
    const review = (
      await data.query("SELECT * FROM listing_reviews WHERE source_issue = 42")
    ).results[0];
    expect(review?.reviewed_by).toBe("maintainer");
    expect(JSON.parse(String(review?.evidence)).body).toBe(data.issue.body);
    expect(JSON.parse(String(review?.evidence)).appIdentity).toEqual(
      appIdentity,
    );
    expect(await publishListing(data.event, data.github, data.query)).toContain(
      "already been published",
    );
    expect(
      (
        await data.query(
          "SELECT * FROM listing_reviews WHERE source_issue = 42",
        )
      ).results,
    ).toHaveLength(1);
  });

  test("ignores a manual app Listing ID and derives the URL from upstream metadata", async () => {
    const data = setup("[App] Editor", {
      ...appFields,
      "Listing ID": "manual-slug",
    });
    await publishListing(data.event, data.github, data.query);
    expect(await data.catalog.get("apps", "manual-slug")).toBeNull();
    expect((await data.catalog.get("apps", "org-example-editor"))?.appId).toBe(
      appIdentity.appId,
    );
  });

  test("preserves an existing app URL and views when adopting the detected ID", async () => {
    const data = setup();
    data.insert("apps", {
      id: "legacy-editor",
      name: "Editor",
      href: appIdentity.repository,
      summary: "Old summary",
      submittedBy: "",
      tags: [],
    });
    await data.query(
      "UPDATE listings SET source_issue = 42, revision = 'legacy-review' WHERE category = 'apps' AND slug = 'legacy-editor'",
    );
    await data.views.increment("apps", "legacy-editor");
    await publishListing(data.event, data.github, data.query);
    expect((await data.catalog.get("apps", "legacy-editor"))?.appId).toBe(
      appIdentity.appId,
    );
    expect(await data.views.read("apps", "legacy-editor")).toBe(1);
    expect(await data.catalog.get("apps", "org-example-editor")).toBeNull();
  });

  test("rejects upstream lookup failures and approvals for a different repository revision", async () => {
    for (const fail of [true, false]) {
      const data = setup();
      await expect(
        publishListing(
          data.event,
          data.github,
          data.query,
          undefined,
          async () => {
            if (fail) throw new Error("Metadata unavailable");
            return { ...appIdentity, commit: "b".repeat(40) };
          },
        ),
      ).rejects.toThrow();
      expect(await data.catalog.list("apps")).toEqual([]);
    }
  });

  test("rejects replacing an existing app identity or duplicating one under another slug", async () => {
    for (const sameIssue of [true, false]) {
      const data = setup();
      data.insert("apps", {
        id: "legacy-editor",
        appId: sameIssue ? "org.example.Other" : appIdentity.appId,
        name: "Original",
        href: appIdentity.repository,
        summary: "Original",
        submittedBy: "",
        tags: [],
      });
      if (sameIssue)
        await data.query(
          "UPDATE listings SET source_issue = 42, revision = 'legacy-review' WHERE category = 'apps' AND slug = 'legacy-editor'",
        );
      await expect(
        publishListing(data.event, data.github, data.query),
      ).rejects.toThrow(sameIssue ? "app ID changed" : "belongs to another");
      expect((await data.catalog.get("apps", "legacy-editor"))?.name).toBe(
        "Original",
      );
    }
  });

  test("the atomic write also rejects concurrent duplicates of a native app ID", async () => {
    const data = setup();
    await publishListing(data.event, data.github, data.query);
    const result = await data.query(publishSql, [
      "apps",
      "another-url",
      JSON.stringify({ id: "another-url", appId: appIdentity.appId }),
      43,
      "other-approval",
      "fingerprint",
      "maintainer",
      "{}",
      "2026-09-06",
      null,
    ]);
    expect(result.results).toEqual([]);
    expect(await data.catalog.get("apps", "another-url")).toBeNull();
  });

  test("publishes a skill only after current PASS/PASS audits, retaining Snyk WARN evidence", async () => {
    const data = setup("[Skill] GTK", skillFields);
    const check = async () => parseAudits(html, skillFields["skills.sh URL"]);
    await publishListing(data.event, data.github, data.query, check);
    expect(await data.catalog.get("skills", "submission-42")).not.toBeNull();
    const row = (
      await data.query(
        "SELECT evidence FROM listing_reviews WHERE source_issue = 42",
      )
    ).results[0];
    expect(
      JSON.parse(String(row?.evidence)).audits.audits.map(
        (audit: { status: string }) => audit.status,
      ),
    ).toEqual(["PASS", "PASS", "WARN"]);
  });

  test.each([
    "read",
    "triage",
    "bot",
    "edited",
    "stale",
    "no report",
    "spoofed report",
    "closed",
    "changed",
  ])("does not write for %s approval", async (reason) => {
    const data = setup();
    if (["read", "triage"].includes(reason)) data.state.permission = reason;
    if (reason === "bot") data.event.comment.user.type = "Bot";
    if (reason === "edited") data.event.action = "edited";
    if (reason === "stale") data.issue.body += "\nUpdated";
    if (reason === "no report") data.state.report = false;
    if (reason === "spoofed report") data.state.bot = false;
    if (reason === "closed") data.issue.state = "closed";
    if (reason === "changed") data.state.changeOnFinal = true;
    await expect(
      publishListing(data.event, data.github, data.query),
    ).rejects.toThrow();
    expect(await data.catalog.list("apps")).toEqual([]);
  });

  test("blocks skill publication if required audits change or become unavailable", async () => {
    for (const missing of [false, true]) {
      const data = setup("[Skill] GTK", skillFields);
      await expect(
        publishListing(data.event, data.github, data.query, async () => {
          if (missing) throw new Error("offline");
          return parseAudits(
            html.replace("Socket</span><span>Pass", "Socket</span><span>Warn"),
            skillFields["skills.sh URL"],
          );
        }),
      ).rejects.toThrow();
      expect(await data.catalog.list("skills")).toEqual([]);
    }
  });

  test("updates an extension from D1 while preserving its slug, added date, assets, and views", async () => {
    const original = seed[0];
    if (!original) throw new Error("Missing seed");
    const data = setup("[Update] Extension", {
      "Extension name": original.metadata.name,
      "Extension UUID": original.metadata.uuid,
      "Source repository": original.source,
      "Requested changes": "New release",
      "Updated metadata.json": JSON.stringify({
        ...original.metadata,
        version: 15,
      }),
      "Your relationship to the extension": "Author",
    });
    await data.views.increment("extensions", original.slug);
    await publishListing(data.event, data.github, data.query);
    const saved = await data.catalog.get("extensions", original.slug);
    expect(saved?.metadata.version).toBe(15);
    expect(saved?.added).toBe(original.added);
    expect(saved?.icon).toBe(original.icon);
    expect(await data.views.read("extensions", original.slug)).toBe(1);
  });

  test("rejects a conflicting listing ID and invalid URLs instead of overwriting another listing", async () => {
    const data = setup();
    data.insert("apps", {
      id: "org-example-editor",
      name: "Existing",
      href: "https://example.org",
      summary: "Existing app",
      submittedBy: "Another author",
      tags: [],
    });
    await expect(
      publishListing(data.event, data.github, data.query),
    ).rejects.toThrow("belongs to another");
    expect((await data.catalog.get("apps", "org-example-editor"))?.name).toBe(
      "Existing",
    );
    const invalid = setup("[App] Bad URL", {
      ...appFields,
      "Repository or project URL": "javascript:alert(1)",
    });
    await expect(
      publishListing(invalid.event, invalid.github, invalid.query),
    ).rejects.toThrow("validation failed");
  });

  test("SQL revision checks prevent lost updates and history failures roll back publication", async () => {
    const data = setup();
    await publishListing(data.event, data.github, data.query);
    const payload = JSON.stringify({
      id: "org-example-editor",
      name: "Overwrite",
    });
    const params = [
      "apps",
      "org-example-editor",
      payload,
      42,
      "second",
      "fingerprint",
      "maintainer",
      "{}",
      "2026-09-06",
      "stale",
    ];
    expect((await data.query(publishSql, params)).results).toEqual([]);
    expect((await data.catalog.get("apps", "org-example-editor"))?.name).toBe(
      "Editor's app",
    );
    // Reusing the history revision makes the trigger fail; the row must stay intact.
    params[4] = "comment-999";
    params[9] = "comment-999";
    await expect(data.query(publishSql, params)).rejects.toThrow();
    expect((await data.catalog.get("apps", "org-example-editor"))?.name).toBe(
      "Editor's app",
    );
  });
});
