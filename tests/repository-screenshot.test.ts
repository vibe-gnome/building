import { expect, test } from "bun:test";
import { repositoryScreenshot } from "../app/server/repository-screenshot";

const repository = "https://github.com/example/project";
const screenshot =
  "https://repository-images.githubusercontent.com/12345/preview-123.png";
const page = (head: string, body = "") =>
  new Response(`<html><head>${head}</head><body>${body}</body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

test("reads the repository's custom social preview with an HTML parser and no credentials", async () => {
  const calls: string[] = [];
  const image = await repositoryScreenshot(
    `${repository}.git`,
    async (url, init) => {
      calls.push(url);
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeDefined();
      expect(new Headers(init?.headers).get("Accept")).toBe("text/html");
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      return page(
        `<meta content='${screenshot}' property='og:image'>`,
        `<meta property="og:image" content="https://attacker.example/image.png"><script>throw new Error('never executed')</script>`,
      );
    },
  );
  expect(image).toBe(screenshot);
  expect(calls).toEqual([repository]);
});

test.each([
  "https://opengraph.githubassets.com/hash/example/project",
  "https://avatars.githubusercontent.com/u/12345",
  "https://repository-images.githubusercontent.com.attacker.example/12345/image.png",
  "http://repository-images.githubusercontent.com/12345/image.png",
  "https://user:password@repository-images.githubusercontent.com/12345/image.png",
  "https://repository-images.githubusercontent.com:8443/12345/image.png",
  "https://repository-images.githubusercontent.com/12345/image.png#fragment",
  "data:image/svg+xml,test",
  "javascript:alert(1)",
  "/relative.png",
])(
  "does not import generated cards, avatars, or unsupported image URLs: %s",
  async (image) => {
    expect(
      await repositoryScreenshot(repository, async () =>
        page(`<meta property="og:image" content="${image}">`),
      ),
    ).toBeUndefined();
  },
);

test("omits missing, ambiguous, and body-only previews", async () => {
  for (const response of [
    page(""),
    page(
      `<meta property="og:image" content="${screenshot}"><meta property="og:image" content="https://repository-images.githubusercontent.com/12345/other.png">`,
    ),
    page("", `<meta property="og:image" content="${screenshot}">`),
    page(`<!-- <meta property="og:image" content="${screenshot}"> -->`),
  ])
    expect(
      await repositoryScreenshot(repository, async () => response),
    ).toBeUndefined();
});

test("preview errors and oversized pages do not block publication", async () => {
  for (const response of [
    new Response(null, {
      status: 301,
      headers: { Location: "https://example.com" },
    }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 429 }),
    new Response(null, { status: 500 }),
    Response.json({ message: "Not HTML" }),
    page(" ".repeat(2 * 1024 * 1024)),
  ])
    expect(
      await repositoryScreenshot(repository, async () => response),
    ).toBeUndefined();
  expect(
    await repositoryScreenshot(repository, async () => {
      throw new Error("Network unavailable");
    }),
  ).toBeUndefined();
});

test("GitLab repositories skip GitHub social preview discovery", async () => {
  let calls = 0;
  for (const host of ["gitlab.com", "gitlab.gnome.org"])
    expect(
      await repositoryScreenshot(`https://${host}/group/project`, async () => {
        calls++;
        throw new Error("Unexpected fetch");
      }),
    ).toBeUndefined();
  expect(calls).toBe(0);
});
