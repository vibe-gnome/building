import { expect, test } from "bun:test";
import { resolveExtensionIdentity } from "../app/server/extension-identity";

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
  options: { truncated?: boolean; mode?: string; size?: number } = {},
) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
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
        })),
      });
    for (const [path, text] of Object.entries(files))
      if (url.endsWith(`/contents/${path}?ref=${commit}`))
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
  expect(data.requests).toHaveLength(4);
  for (const { init } of data.requests) {
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  }
});

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
