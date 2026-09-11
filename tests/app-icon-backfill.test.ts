import { describe, expect, test } from "bun:test";
import { appIconBackfillSql } from "../scripts/backfill-app-icons";
import { catalogDatabase } from "./helpers/catalog-db";

const commit = "a".repeat(40);
const repository = "https://github.com/example/editor";
const path = "data/org.example.Editor.metainfo.xml";
const iconPath = "data/icons/hicolor/scalable/apps/org.example.Editor.svg";
const icon = `https://raw.githubusercontent.com/example/editor/${commit}/${iconPath}`;
const identity = { appId: "org.example.Editor", repository, commit, path };
const payload = {
  id: "editor",
  name: "Editor's app",
  appId: identity.appId,
  href: repository,
  summary: "An editor",
  submittedBy: "Maintainer",
  tags: ["GTK"],
};
const row = {
  slug: payload.id,
  revision: "comment-123",
  payload: JSON.stringify(payload),
  evidence: JSON.stringify({ appIdentity: identity, approvalComment: 123 }),
};

function upstream(options: { commit?: string; paths?: string[] } = {}) {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    if (url === "https://api.github.com/repos/example/editor")
      return Response.json({ default_branch: "main", private: false });
    if (url.endsWith(`/commits/${commit}`))
      return Response.json({ sha: options.commit ?? commit });
    if (url.endsWith(`/git/trees/${commit}?recursive=1`))
      return Response.json({
        tree: (options.paths ?? [path, iconPath]).map((path) => ({
          path,
          mode: "100644",
          type: "blob",
        })),
        truncated: false,
      });
    throw new Error(`Unexpected request: ${url}`);
  };
  return { fetcher, requests };
}

function database() {
  const data = catalogDatabase();
  data.db
    .query(
      "INSERT INTO listings (category, slug, payload, revision, evidence, reviewed_by, submission_fingerprint, source_issue, created_at, updated_at) VALUES ('apps', ?, ?, ?, ?, 'original-reviewer', 'original-fingerprint', 5, '2026-09-08', '2026-09-08')",
    )
    .run(row.slug, row.payload, row.revision, row.evidence);
  data.db.exec("INSERT INTO listing_views VALUES ('apps', 'editor', 42)");
  return data;
}

describe("existing app icon backfill", () => {
  test("uses the reviewed commit and preserves approvals, listing identity, and views", async () => {
    const source = upstream();
    const sql = await appIconBackfillSql([row], source.fetcher, "2026-09-09");
    expect(source.requests).toHaveLength(3);
    expect(source.requests.some((url) => url.endsWith("/commits/main"))).toBe(
      false,
    );
    const data = database();
    try {
      const original = await data.catalog.get("apps", "editor");
      if (!original) throw new Error("Missing test app.");
      data.db.exec(sql);
      expect(await data.catalog.get("apps", "editor")).toEqual({
        ...original,
        icon,
      });
      expect(await data.views.read("apps", "editor")).toBe(42);
      const reviews = data.db
        .query<
          {
            payload: string;
            evidence: string;
            reviewed_by: string;
            submission_fingerprint: string;
          },
          []
        >(
          "SELECT payload, evidence, reviewed_by, submission_fingerprint FROM listing_reviews WHERE category = 'apps' ORDER BY reviewed_at",
        )
        .all();
      expect(reviews).toHaveLength(2);
      expect(reviews[0]).toEqual({
        payload: row.payload,
        evidence: row.evidence,
        reviewed_by: "original-reviewer",
        submission_fingerprint: "original-fingerprint",
      });
      const evidence = JSON.parse(reviews[1]?.evidence ?? "{}");
      expect(evidence.appIdentity).toEqual(identity);
      expect(evidence.approvalComment).toBe(123);
      expect(evidence.iconBackfill).toMatchObject({
        icon,
        commit,
        previousRevision: row.revision,
      });
      expect(reviews[1]?.reviewed_by).toBe("repository-icon-backfill");
      data.db.exec(sql);
      expect(
        data.db
          .query("SELECT * FROM listing_reviews WHERE category = 'apps'")
          .all(),
      ).toHaveLength(2);
    } finally {
      data.db.close();
    }
  });

  test("does not overwrite a concurrent publication or unpublished app", async () => {
    const sql = await appIconBackfillSql([row], upstream().fetcher);
    for (const update of [
      "revision = 'new-review'",
      "status = 'unpublished', revision = 'removed'",
    ]) {
      const data = database();
      try {
        data.db.exec(`UPDATE listings SET ${update} WHERE category = 'apps'`);
        data.db.exec(sql);
        expect(
          data.db
            .query("SELECT payload FROM listings WHERE category = 'apps'")
            .get(),
        ).toEqual({ payload: row.payload });
      } finally {
        data.db.close();
      }
    }
  });

  test("skips existing icons, missing review identity, and repositories without icons", async () => {
    const source = upstream();
    expect(
      await appIconBackfillSql(
        [
          { ...row, payload: JSON.stringify({ ...payload, icon }) },
          { ...row, evidence: "{}" },
        ],
        source.fetcher,
      ),
    ).toBe("");
    expect(source.requests).toHaveLength(0);
    expect(
      await appIconBackfillSql([row], upstream({ paths: [path] }).fetcher),
    ).toBe("");
  });

  test("rejects mismatched identities and commits instead of using a newer revision", async () => {
    await expect(
      appIconBackfillSql(
        [
          {
            ...row,
            evidence: JSON.stringify({
              appIdentity: { ...identity, appId: "org.example.Other" },
            }),
          },
        ],
        upstream().fetcher,
      ),
    ).rejects.toThrow("does not match");
    await expect(
      appIconBackfillSql([row], upstream({ commit: "b".repeat(40) }).fetcher),
    ).rejects.toThrow("reviewed commit");
    await expect(
      appIconBackfillSql([row], upstream({ paths: [iconPath] }).fetcher),
    ).rejects.toThrow("Reviewed metadata is missing");
  });
});
