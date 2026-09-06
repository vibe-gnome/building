import { afterEach, describe, expect, test } from "bun:test";
import seed from "../app/data/extensions.json";
import { parseAudits } from "../scripts/check-skill-audits";
import {
  type GitHubRequest,
  listingFingerprint,
} from "../scripts/listing-review";
import {
  type PublishEvent,
  publishListing,
  publishSql,
} from "../scripts/publish-listing";
import { catalogDatabase } from "./helpers/catalog-db";

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
  "Listing ID": "editor",
  "Repository or project URL": "https://example.org/editor",
  Summary: "A GTK app",
  "Installation and usage": "Read the guide",
  "Author and license": "Maintainer / MIT",
};
const skillFields = {
  "Skill name": "GTK",
  "Listing ID": "gtk",
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

function setup(
  title = "[App] Editor",
  values = appFields as Record<string, string>,
) {
  const data = catalogDatabase();
  databases.push(data);
  const issue = { number: 42, title, body: fields(values), state: "open" };
  const fingerprint = listingFingerprint(issue);
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
  test("publishes an app with its approval history atomically and retries without duplicate writes", async () => {
    const data = setup();
    expect(await publishListing(data.event, data.github, data.query)).toContain(
      "Published",
    );
    expect((await data.catalog.get("apps", "editor"))?.name).toBe(
      "Editor's app",
    );
    const review = (
      await data.query("SELECT * FROM listing_reviews WHERE source_issue = 42")
    ).results[0];
    expect(review?.reviewed_by).toBe("maintainer");
    expect(JSON.parse(String(review?.evidence)).body).toBe(data.issue.body);
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

  test("publishes a skill only after current PASS/PASS audits, retaining Snyk WARN evidence", async () => {
    const data = setup("[Skill] GTK", skillFields);
    const check = async () => parseAudits(html, skillFields["skills.sh URL"]);
    await publishListing(data.event, data.github, data.query, check);
    expect(await data.catalog.get("skills", "gtk")).not.toBeNull();
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
      id: "editor",
      name: "Existing",
      href: "https://example.org",
      summary: "Existing app",
      submittedBy: "Another author",
      tags: [],
    });
    await expect(
      publishListing(data.event, data.github, data.query),
    ).rejects.toThrow("belongs to another");
    expect((await data.catalog.get("apps", "editor"))?.name).toBe("Existing");
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
    const payload = JSON.stringify({ id: "editor", name: "Overwrite" });
    const params = [
      "apps",
      "editor",
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
    expect((await data.catalog.get("apps", "editor"))?.name).toBe(
      "Editor's app",
    );
    // Reusing the history revision makes the trigger fail; the row must stay intact.
    params[4] = "comment-999";
    params[9] = "comment-999";
    await expect(data.query(publishSql, params)).rejects.toThrow();
    expect((await data.catalog.get("apps", "editor"))?.name).toBe(
      "Editor's app",
    );
  });
});
