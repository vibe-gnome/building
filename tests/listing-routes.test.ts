import { afterEach, expect, test } from "bun:test";
import { loadListingById } from "../app/lib/catalog-client";
import { listingPath } from "../app/lib/listing-links";
import { loadListingPage } from "../app/lib/listing-loader";
import { handleCatalogRequest } from "../app/server/catalog-api";
import { catalogDatabase } from "./helpers/catalog-db";

const databases: ReturnType<typeof catalogDatabase>[] = [];
afterEach(() => {
  for (const data of databases.splice(0)) data.db.close();
});

test("every category resolves canonical links and redirects legacy or stale names", async () => {
  const data = catalogDatabase();
  databases.push(data);
  data.insert("apps", {
    id: "old-planner",
    appId: "us.hagreli.Planner",
    name: "Planner",
    href: "https://github.com/mhagrelius/planner",
    summary: "Tasks",
    submittedBy: "",
    tags: [],
  });
  data.insert("skills", {
    id: "old-skill",
    name: "Find Skills",
    href: "https://skills.sh/vercel-labs/skills/find-skills/",
    description: "Guidance",
  });
  const fetcher = (input: string, init?: RequestInit) =>
    handleCatalogRequest(
      new Request(new URL(String(input), "https://vibe-gnome.org"), init),
      data.catalog,
    );
  for (const [category, id, name, legacy] of [
    ["apps", 3, "planner", "old-planner"],
    ["extensions", 1, "codex-usage-indicator", "codex-usage-indicator"],
    ["skills", 4, "find-skills", "old-skill"],
  ] as const) {
    const canonical = `/${category}/${id}/${name}`;
    const entry = await loadListingPage(
      category,
      { dbId: String(id), slug: name },
      new Request(`https://vibe-gnome.org${canonical}`),
      fetcher,
    );
    expect(entry?.dbId).toBe(id);
    if (!entry) throw new Error("Missing entry");
    expect(listingPath(category, entry)).toBe(canonical);
    for (const [dbId, slug] of [
      [legacy, undefined],
      [String(id), "old-name"],
      [String(id), undefined],
    ] as const) {
      const path = `/${category}/${dbId}${slug ? `/${slug}` : ""}?view=list`;
      try {
        await loadListingPage(
          category,
          { dbId, slug },
          new Request(`https://vibe-gnome.org${path}`),
          fetcher,
        );
        throw new Error("Expected redirect");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).headers.get("Location")).toBe(
          `${canonical}?view=list`,
        );
        expect((error as Response).headers.get("X-Remix-Replace")).toBe("true");
      }
    }
  }
  for (const dbId of ["missing", "0", "9007199254740992", "999"])
    expect(
      await loadListingPage(
        "apps",
        { dbId, slug: "planner" },
        new Request(`https://vibe-gnome.org/apps/${dbId}/planner`),
        fetcher,
      ),
    ).toBeNull();
});

test("old numeric slugs redirect to their own record even if another row has that DB ID", async () => {
  const data = catalogDatabase();
  databases.push(data);
  const original = (await data.catalog.list("extensions"))[0];
  if (!original) throw new Error("Missing extension fixture");
  data.insert("extensions", {
    ...original,
    slug: "1",
    metadata: {
      uuid: "numeric@example.org",
      name: "Numeric",
      description: "Legacy",
      "shell-version": ["50"],
    },
  });
  const fetcher = (input: string, init?: RequestInit) =>
    handleCatalogRequest(
      new Request(new URL(String(input), "https://vibe-gnome.org"), init),
      data.catalog,
    );
  await loadListingPage(
    "extensions",
    { dbId: "1" },
    new Request("https://vibe-gnome.org/extensions/1"),
    fetcher,
  ).then(
    () => {
      throw new Error("Expected redirect");
    },
    (error: Response) =>
      expect(error.headers.get("Location")).toBe("/extensions/3/numeric"),
  );
});

test("numeric detail client rejects mismatched IDs and categories", async () => {
  for (const data of [
    { category: "apps", entry: { dbId: 2 } },
    { category: "skills", entry: { dbId: 1 } },
  ])
    await expect(
      loadListingById("apps", 1, AbortSignal.timeout(1000), async () =>
        Response.json(data),
      ),
    ).rejects.toBeInstanceOf(Response);
});
