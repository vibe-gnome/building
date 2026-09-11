import { expect, test } from "bun:test";
import { resolveAppIdentity } from "../app/server/app-identity";
import { resolveExtensionIdentity } from "../app/server/extension-identity";
import {
  isPreviewImage,
  maximumPreviewBytes,
} from "../app/server/preview-image";
import { repositoryMetadata } from "../app/server/repository-metadata";
import { repositoryScreenshot } from "../app/server/repository-screenshot";
import { createRepositoryFetcher } from "../scripts/repository-fetch";
import { imageDimensions, previewImage } from "./helpers/preview-image";

const repository = "https://github.com/example/project";
const api = "https://api.github.com/repos/example/project";
const commit = "a".repeat(40);
const raw = `https://raw.githubusercontent.com/example/project/${commit}/`;
const social = "https://repository-images.githubusercontent.com/123/social.png";

function fixture(
  readme: string,
  images: Record<string, () => Response> = { "screen.png": previewImage },
  options: {
    readmePath?: string;
    social?: boolean;
    entries?: Record<string, { size?: number; mode?: string }>;
  } = {},
) {
  const readmePath = options.readmePath ?? "README.md";
  const texts: Record<string, string> = {
    [readmePath]: readme,
    "org.example.App.metainfo.xml":
      '<component type="desktop-application"><id>org.example.App</id></component>',
    "metadata.json": JSON.stringify({
      uuid: "project@example.org",
      name: "Project",
      description: "A project",
      "shell-version": ["50"],
    }),
  };
  const calls: string[] = [];
  const fetcher = createRepositoryFetcher("test-token", async (url, init) => {
    calls.push(url);
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeDefined();
    expect(new Headers(init?.headers).has("Authorization")).toBe(
      url.startsWith(api),
    );
    if (url === api) return Response.json({ default_branch: "stable/next" });
    if (url === `${api}/commits/stable%2Fnext`)
      return Response.json({ sha: commit });
    if (url === `${api}/git/trees/${commit}?recursive=1`)
      return Response.json({
        tree: [
          ...Object.keys(texts),
          ...Object.keys(images).filter((path) => !path.startsWith("https:")),
        ].map((path) => ({
          path,
          mode: "100644",
          type: "blob",
          ...options.entries?.[path],
        })),
      });
    for (const [path, text] of Object.entries(texts))
      if (
        url ===
        `${api}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`
      )
        return new Response(text);
    if (url === repository)
      return new Response(
        `<head>${options.social ? `<meta property="og:image" content="${social}">` : ""}</head>`,
        { headers: { "Content-Type": "text/html" } },
      );
    if (url === social) return previewImage();
    const image =
      images[url] ??
      (url.startsWith(raw)
        ? images[decodeURIComponent(url.slice(raw.length))]
        : undefined);
    if (!image) throw new Error(`Unexpected fetch: ${url}`);
    expect(init?.credentials).toBe("omit");
    return image();
  });
  return {
    fetcher,
    calls,
    async screenshot() {
      const snapshot = await repositoryMetadata(
        repository,
        /metadata\.json$/,
        fetcher,
      );
      return repositoryScreenshot(repository, fetcher, snapshot);
    },
  };
}

test.each([resolveAppIdentity, resolveExtensionIdentity])(
  "%p imports a README preview into the reviewed identity before the social fallback",
  async (resolve) => {
    const data = fixture("![Screenshot](screen.png)", undefined, {
      social: true,
    });
    expect((await resolve(repository, data.fetcher)).screenshot).toBe(
      `${raw}screen.png`,
    );
    expect(data.calls).not.toContain(repository);
  },
);

test.each([
  "![Screenshot](./screen.png)",
  "[![Screenshot](screen.png)](https://example.org)",
  '![Screenshot][demo]\n\n[demo]: screen.png "Project"',
  "<picture><source srcset='ignored.avif'><img src='screen.png' width='10' height='10'></picture>",
  "![Screenshot](/screen.png)",
  "![Screenshot](https://github.com/example/project/blob/stable/next/screen.png?raw=true)",
  "![Screenshot](https://raw.githubusercontent.com/example/project/stable/next/screen.png)",
])(
  "resolves Markdown and HTML images to the reviewed commit: %s",
  async (readme) => {
    expect(await fixture(readme).screenshot()).toBe(`${raw}screen.png`);
  },
);

test("resolves encoded paths relative to a nested README", async () => {
  const data = fixture(
    "![Screenshot](<../assets/My screen.png>)",
    { "assets/My screen.png": previewImage },
    { readmePath: "docs/Readme.MD" },
  );
  expect(await data.screenshot()).toBe(`${raw}assets/My%20screen.png`);
});

test("ignores small images, banners, branding, code, comments, duplicates, and broken images", async () => {
  const data = fixture(
    `
![Logo](logo.png)
![status](small.png)
<img src="wide.png" width="1000" height="900">
![Failure](broken.png)
![Failure again](broken.png)
\`![Example](code.png)\`
\`\`\`md
![Example](code.png)
\`\`\`
<!-- <img src="comment.png"> -->
![Screenshot](screen.png)
`,
    {
      "logo.png": previewImage,
      "small.png": () => imageDimensions(128, 128),
      "wide.png": () => imageDimensions(1200, 100),
      "broken.png": () => new Response("Unavailable", { status: 404 }),
      "code.png": previewImage,
      "comment.png": previewImage,
      "screen.png": previewImage,
    },
  );
  expect(await data.screenshot()).toBe(`${raw}screen.png`);
  expect(data.calls.filter((url) => url.startsWith(raw))).toEqual(
    ["small.png", "wide.png", "broken.png", "screen.png"].map(
      (path) => `${raw}${path}`,
    ),
  );
});

test.each(["png", "jpg", "gif", "webp"])(
  "checks actual %s image bytes",
  async (format) => {
    expect(
      await isPreviewImage(`${raw}image`, async () => previewImage(format)),
    ).toBe(true);
  },
);

test.each([
  [480, 270, true],
  [479, 270, false],
  [480, 269, false],
  [256, 1024, false],
])(
  "requires both minimum dimensions: %s × %s",
  async (width, height, accepted) => {
    expect(
      await isPreviewImage(`${raw}image`, async () =>
        imageDimensions(Number(width), Number(height)),
      ),
    ).toBe(accepted);
  },
);

test("rejects unverifiable formats, malformed images, oversized bodies and fetch failures", async () => {
  for (const response of [
    new Response(
      '<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"/>',
    ),
    new Response("<html>not an image</html>", {
      headers: { "Content-Type": "image/png" },
    }),
    new Response(new Uint8Array(maximumPreviewBytes + 1)),
    new Response("", {
      headers: { "Content-Length": String(maximumPreviewBytes + 1) },
    }),
    new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/image" },
    }),
  ])
    expect(await isPreviewImage(`${raw}image`, async () => response)).toBe(
      false,
    );
  expect(
    await isPreviewImage(`${raw}image`, async () => {
      throw new Error("timeout");
    }),
  ).toBe(false);
});

test.each([
  "https://attacker.example/image.png",
  "http://127.0.0.1/image.png",
  "https://user-images.githubusercontent.com.attacker.example/123/image.png",
  "https://user:pass@user-images.githubusercontent.com/123/image.png",
  "https://user-images.githubusercontent.com:8443/123/image.png",
  "https://raw.githubusercontent.com/other/private/main/screen.png",
  "javascript:alert(1)",
  "data:image/png;base64,abc",
  "missing.png",
])("does not fetch unsupported image targets: %s", async (url) => {
  const data = fixture(`<img src="${url}">`);
  expect(await data.screenshot()).toBeUndefined();
  expect(data.calls).not.toContain(url);
  expect(data.calls.filter((url) => url.startsWith(raw))).toEqual([]);
});

test("accepts public GitHub image uploads after checking their dimensions", async () => {
  const upload = "https://user-images.githubusercontent.com/123/upload.png";
  expect(
    await fixture(`![Screenshot](${upload})`, {
      [upload]: previewImage,
    }).screenshot(),
  ).toBe(upload);
});

test("skips excluded, symlinked and oversized repository images before fetching", async () => {
  const data = fixture(
    "![One](tests/screen.png)\n![Two](link.png)\n![Three](huge.png)",
    {
      "tests/screen.png": previewImage,
      "link.png": previewImage,
      "huge.png": previewImage,
    },
    {
      entries: {
        "link.png": { mode: "120000" },
        "huge.png": { size: maximumPreviewBytes + 1 },
      },
    },
  );
  expect(await data.screenshot()).toBeUndefined();
  expect(data.calls.filter((url) => url.startsWith(raw))).toEqual([]);
});

test("caps image fetch attempts and falls back to the custom social preview", async () => {
  const images = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `${index}.png`,
      () => imageDimensions(16, 16),
    ]),
  );
  const data = fixture(
    Object.keys(images)
      .map((path) => `![](${path})`)
      .join("\n"),
    images,
    { social: true },
  );
  expect(await data.screenshot()).toBe(social);
  expect(data.calls.filter((url) => url.startsWith(raw))).toHaveLength(8);
});

test("an oversized README or no qualifying image leaves discovery optional", async () => {
  for (const readme of [
    "![Screenshot](small.png)",
    "x".repeat(256 * 1024 + 1),
  ]) {
    const data = fixture(readme, {
      "small.png": () => imageDimensions(16, 16),
    });
    expect(
      (await resolveAppIdentity(repository, data.fetcher)).screenshot,
    ).toBeUndefined();
  }
});

test("the social fallback also rejects small images", async () => {
  expect(
    await repositoryScreenshot(repository, async (url) =>
      url === repository
        ? new Response(
            `<head><meta property="og:image" content="${social}"></head>`,
            { headers: { "Content-Type": "text/html" } },
          )
        : imageDimensions(128, 128),
    ),
  ).toBeUndefined();
});

test.each(["gitlab.com", "gitlab.gnome.org"])(
  "imports pinned README screenshots on %s without a social-page lookup",
  async (host) => {
    const repo = `https://${host}/group/project`;
    const api = `https://${host}/api/v4/projects/group%2Fproject`;
    const screenshot = `${repo}/-/raw/${commit}/screen.png`;
    const texts: Record<string, string> = {
      "README.md": `![Screenshot](${repo}/-/blob/main/screen.png)`,
      "metadata.json": JSON.stringify({
        uuid: "project@example.org",
        name: "Project",
        description: "A project",
        "shell-version": ["50"],
      }),
    };
    const fetcher = async (url: string) => {
      if (url === api) return Response.json({ default_branch: "main" });
      if (url === `${api}/repository/commits/main`)
        return Response.json({ id: commit });
      if (
        url ===
        `${api}/repository/tree?ref=${commit}&recursive=true&per_page=100&page=1`
      )
        return Response.json(
          [...Object.keys(texts), "screen.png"].map((path) => ({
            path,
            type: "blob",
            mode: "100644",
          })),
        );
      for (const [path, source] of Object.entries(texts))
        if (
          url ===
          `${api}/repository/files/${encodeURIComponent(path)}/raw?ref=${commit}`
        )
          return new Response(source);
      if (url === screenshot) return previewImage();
      throw new Error(`Unexpected request: ${url}`);
    };
    expect((await resolveExtensionIdentity(repo, fetcher)).screenshot).toBe(
      screenshot,
    );
  },
);
