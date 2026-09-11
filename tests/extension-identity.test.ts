import { expect, test } from "bun:test";
import { resolveExtensionIdentity } from "../app/server/extension-identity";

import { previewImage } from "./helpers/preview-image";

const repository = "https://github.com/example/extension";
const commit = "a".repeat(40);
const metadata = {
  uuid: "example@example.org",
  name: "Example",
  description: "Example extension",
  "shell-version": ["50"],
};
function github(
  files: Record<string, string>,
  options: {
    truncated?: boolean;
    mode?: string;
    size?: number;
    screenshot?: string;
    entries?: Record<string, { mode?: string; size?: number }>;
  } = {},
) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    if (options.screenshot && url === options.screenshot) return previewImage();
    if (url === repository)
      return new Response(
        `<head>${options.screenshot ? `<meta property="og:image" content="${options.screenshot}">` : ""}</head>`,
        { headers: { "Content-Type": "text/html" } },
      );
    if (url.endsWith("/example/extension"))
      return Response.json({ default_branch: "main" });
    if (url.endsWith("/commits/main")) return Response.json({ sha: commit });
    if (url.endsWith(`/git/trees/${commit}?recursive=1`))
      return Response.json({
        truncated: options.truncated ?? false,
        tree: Object.keys(files).map((path) => ({
          path,
          type: "blob",
          mode: options.mode ?? "100644",
          size: options.size,
          ...options.entries?.[path],
        })),
      });
    for (const [path, text] of Object.entries(files))
      if (
        url.endsWith(
          `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`,
        )
      )
        return new Response(text);
    throw new Error(`Unexpected repository request ${url}`);
  };
  return { requests, fetcher };
}

test("extracts extension UUID from a pinned repository metadata.json, ignoring fixtures and code", async () => {
  const data = github({
    "src/metadata.json": JSON.stringify(metadata),
    "tests/metadata.json": "{}",
    "extension.js": "throw new Error('never executed')",
  });
  expect(await resolveExtensionIdentity(repository, data.fetcher)).toEqual({
    repository,
    commit,
    path: "src/metadata.json",
    metadata,
  });
  expect(data.requests).toHaveLength(5);
  for (const { init } of data.requests) {
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  }
});

test("includes a custom repository social preview with the extension identity", async () => {
  const screenshot =
    "https://repository-images.githubusercontent.com/12345/extension-preview.png";
  const data = github(
    { "metadata.json": JSON.stringify(metadata) },
    { screenshot },
  );
  expect(
    (await resolveExtensionIdentity(repository, data.fetcher)).screenshot,
  ).toBe(screenshot);
});

test.each([
  [["icon.svg", "icon.png", "icons/helper.svg"], "icon.svg"],
  [["assets/logo.png", "icons/helper.svg"], "assets/logo.png"],
  [["icons/codex-symbolic.svg"], "icons/codex-symbolic.svg"],
  [["icons/example.svg", "icons/example-symbolic.svg"], "icons/example.svg"],
  [["icons/brand mark.svg"], "icons/brand mark.svg"],
  [["screenshot.png", "docs/preview.svg"], undefined],
  [["icons/first.svg", "icons/second.svg"], undefined],
  [["assets/icon.svg", "icons/icon.svg"], undefined],
  [["tests/icon.svg", "vendor/logo.png", "../icon.svg"], undefined],
] as [string[], string | undefined][])(
  "discovers a pinned icon without fetching arbitrary image contents: %j",
  async (paths, selected) => {
    const data = github({
      "metadata.json": JSON.stringify(metadata),
      ...Object.fromEntries(paths.map((path) => [path, "image bytes"])),
    });
    const identity = await resolveExtensionIdentity(repository, data.fetcher);
    expect(identity.icon).toBe(
      selected
        ? `https://raw.githubusercontent.com/example/extension/${commit}/${selected.split("/").map(encodeURIComponent).join("/")}`
        : undefined,
    );
    expect(data.requests).toHaveLength(5);
  },
);

test("prefers icons beside nested metadata and excludes symlinks and oversized images", async () => {
  const files = {
    "src/metadata.json": JSON.stringify(metadata),
    "src/icon.svg": "image",
    "src/logo.png": "image",
    "src/icons/example.svg": "image",
    "icon.svg": "image",
  };
  expect(
    (await resolveExtensionIdentity(repository, github(files).fetcher)).icon,
  ).toBe(
    `https://raw.githubusercontent.com/example/extension/${commit}/src/icon.svg`,
  );
  const data = github(files, {
    entries: {
      "src/icon.svg": { mode: "120000" },
      "src/logo.png": { size: 2 * 1024 * 1024 },
    },
  });
  expect((await resolveExtensionIdentity(repository, data.fetcher)).icon).toBe(
    `https://raw.githubusercontent.com/example/extension/${commit}/src/icons/example.svg`,
  );
});

test("many unrelated icons do not exhaust the metadata candidate limit", async () => {
  const data = github({
    "metadata.json": JSON.stringify(metadata),
    "icon.png": "image",
    ...Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`icons/helper-${i}.svg`, "image"]),
    ),
  });
  expect((await resolveExtensionIdentity(repository, data.fetcher)).icon).toBe(
    `https://raw.githubusercontent.com/example/extension/${commit}/icon.png`,
  );
});

test.each(["gitlab.com", "gitlab.gnome.org"])(
  "pins GitLab image URLs on %s",
  async (host) => {
    const repo = `https://${host}/group/extension`;
    const api = `https://${host}/api/v4/projects/group%2Fextension`;
    const fetcher = async (url: string) => {
      if (url === api) return Response.json({ default_branch: "main" });
      if (url.endsWith("/commits/main")) return Response.json({ id: commit });
      if (url.endsWith("&page=1"))
        return Response.json(
          ["metadata.json", "icons/brand mark.svg"].map((path) => ({
            path,
            type: "blob",
            mode: "100644",
          })),
        );
      if (url.endsWith(`/repository/files/metadata.json/raw?ref=${commit}`))
        return Response.json(metadata);
      throw new Error(`Unexpected repository request ${url}`);
    };
    expect((await resolveExtensionIdentity(repo, fetcher)).icon).toBe(
      `${repo}/-/raw/${commit}/icons/brand%20mark.svg`,
    );
  },
);

test("blocks missing, ambiguous, templated, malformed, symlinked, incomplete and oversized metadata", async () => {
  for (const [files, options] of [
    [{}, {}],
    [{ "metadata.json": "{}" }, {}],
    [{ "metadata.json": "{broken}" }, {}],
    [{ "metadata.json": "null" }, {}],
    [{ "metadata.json": JSON.stringify({ ...metadata, uuid: "@UUID@" }) }, {}],
    [
      {
        "metadata.json": JSON.stringify(metadata),
        "nested/metadata.json": JSON.stringify(metadata),
      },
      {},
    ],
    [{ "metadata.json": JSON.stringify(metadata) }, { mode: "120000" }],
    [{ "metadata.json": JSON.stringify(metadata) }, { truncated: true }],
    [{ "metadata.json": JSON.stringify(metadata) }, { size: 300_000 }],
    [{ "metadata.json": " ".repeat(300_000) }, {}],
  ] as [
    Record<string, string>,
    { truncated?: boolean; mode?: string; size?: number },
  ][]) {
    const data = github(files, options);
    await expect(
      resolveExtensionIdentity(repository, data.fetcher),
    ).rejects.toThrow();
  }
});

test("rejects unsupported repository URLs before any fetch and reports upstream failures", async () => {
  const data = github({});
  await expect(
    resolveExtensionIdentity("https://example.org/extension", data.fetcher),
  ).rejects.toThrow("repository root URL");
  expect(data.requests).toHaveLength(0);
  await expect(
    resolveExtensionIdentity(
      repository,
      async () => new Response(null, { status: 403 }),
    ),
  ).rejects.toThrow("403");
});
