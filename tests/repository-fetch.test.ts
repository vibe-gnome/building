import { expect, test } from "bun:test";
import { resolveAppIdentity } from "../app/server/app-identity";
import { readRepositoryText } from "../app/server/repository-metadata";
import { createRepositoryFetcher } from "../scripts/repository-fetch";

const repository = "https://github.com/example/app";
const api = "https://api.github.com/repos/example/app";
const commit = "a".repeat(40);
const token = "test-workflow-token";

test("authenticates every app metadata lookup while keeping the social preview anonymous", async () => {
  const calls: string[] = [];
  const fetcher = createRepositoryFetcher(token, async (url, init) => {
    calls.push(url);
    const headers = new Headers(init?.headers);
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeDefined();
    expect(headers.get("User-Agent")).toBe("vibe-gnome-listing-review");
    if (url === repository) {
      expect(headers.has("Authorization")).toBe(false);
      return new Response("<head></head>", {
        headers: { "Content-Type": "text/html" },
      });
    }
    expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
    expect(headers.get("X-GitHub-Api-Version")).toBe("2022-11-28");
    if (url === api)
      return Response.json({ default_branch: "main", private: false });
    if (url === `${api}/commits/main`) return Response.json({ sha: commit });
    if (url === `${api}/git/trees/${commit}?recursive=1`)
      return Response.json({
        truncated: false,
        tree: [
          {
            path: "org.example.App.metainfo.xml",
            mode: "100644",
            type: "blob",
          },
        ],
      });
    expect(url).toBe(
      `${api}/contents/org.example.App.metainfo.xml?ref=${commit}`,
    );
    expect(headers.get("Accept")).toBe("application/vnd.github.raw+json");
    return new Response(
      '<component type="desktop-application"><id>org.example.App</id></component>',
    );
  });
  expect((await resolveAppIdentity(repository, fetcher)).appId).toBe(
    "org.example.App",
  );
  expect(calls).toHaveLength(5);
});

test.each([
  "https://github.com/example/app",
  "https://raw.githubusercontent.com/example/app/main/metadata.json",
  "https://repository-images.githubusercontent.com/123/preview.png",
  "https://gitlab.com/api/v4/projects/example",
  "https://gitlab.gnome.org/api/v4/projects/example",
  "https://api.github.com.attacker.example/repos/example/app",
  "https://api.github.com:8443/repos/example/app",
  "http://api.github.com/repos/example/app",
  "https://user:password@api.github.com/repos/example/app",
  "https://api.github.com/user",
])("never forwards the token to %s", async (url) => {
  const fetcher = createRepositoryFetcher(token, async (_, init) => {
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("Accept")).toBe("text/html");
    expect(init?.redirect).toBe("error");
    return new Response("");
  });
  await fetcher(url, {
    redirect: "follow",
    headers: { Authorization: `Bearer ${token}`, Accept: "text/html" },
  });
});

test("authenticated lookup rejects private repositories before fetching their contents", async () => {
  let calls = 0;
  await expect(
    resolveAppIdentity(
      repository,
      createRepositoryFetcher(token, async () => {
        calls++;
        return Response.json({ default_branch: "main", private: true });
      }),
    ),
  ).rejects.toThrow("must be public");
  expect(calls).toBe(1);
});

test("reports primary GitHub rate limits with their reset time", async () => {
  await expect(
    readRepositoryText(
      api,
      async () =>
        Response.json(
          { message: "API rate limit exceeded for runner IP" },
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "2000000000",
            },
          },
        ),
      1024,
    ),
  ).rejects.toThrow(
    "Repository metadata request failed (403) from api.github.com: API rate limit exceeded. Retry after 2033-05-18T03:33:20.000Z.",
  );
});

test("reports secondary rate-limit retry delays", async () => {
  await expect(
    readRepositoryText(
      api,
      async () =>
        Response.json(
          { message: "You have exceeded a secondary rate limit." },
          { status: 403, headers: { "retry-after": "60" } },
        ),
      1024,
    ),
  ).rejects.toThrow("secondary rate limit. Retry after 60 seconds.");
});

test("retains actionable permission errors without labeling every 403 as a rate limit", async () => {
  await expect(
    readRepositoryText(
      api,
      async () =>
        Response.json(
          { message: "Resource not accessible by integration" },
          { status: 403 },
        ),
      1024,
    ),
  ).rejects.toThrow("Resource not accessible by integration");
});

test.each(["<html>Unavailable</html>", "x".repeat(17 * 1024)])(
  "non-JSON or oversized error pages retain the HTTP status",
  async (body) => {
    await expect(
      readRepositoryText(
        api,
        async () => new Response(body, { status: 502 }),
        1024,
      ),
    ).rejects.toThrow(
      "Repository metadata request failed (502) from api.github.com.",
    );
  },
);
