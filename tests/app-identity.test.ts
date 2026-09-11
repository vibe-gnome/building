import { describe, expect, test } from "bun:test";
import { appIdentitySlug, appRepository } from "../app/lib/app-identity";
import { metadataAppIds, resolveAppIdentity } from "../app/server/app-identity";

import { previewImage } from "./helpers/preview-image";

const repository = "https://github.com/mhagrelius/planner";
const commit = "a".repeat(40);
const path = "data/us.hagreli.Planner.metainfo.xml";
const metadata =
  '<component type="desktop-application"><id>us.hagreli.Planner</id></component>';
const entry = (path: string) => ({ path, mode: "100644", type: "blob" });

function github(
  files: Record<string, string> = { [path]: metadata },
  options: {
    truncated?: boolean;
    status?: number;
    size?: number;
    screenshot?: string;
    entries?: Record<string, { mode?: string; size?: number }>;
  } = {},
) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    if (options.status)
      return new Response("Unavailable", { status: options.status });
    if (options.screenshot && url === options.screenshot) return previewImage();
    if (url === repository)
      return new Response(
        `<head>${options.screenshot ? `<meta property="og:image" content="${options.screenshot}">` : ""}</head>`,
        { headers: { "Content-Type": "text/html" } },
      );
    if (url.endsWith("/planner"))
      return Response.json({ default_branch: "stable/next" });
    if (url.endsWith("/commits/stable%2Fnext"))
      return Response.json({ sha: commit });
    if (url.endsWith(`/git/trees/${commit}?recursive=1`))
      return Response.json({
        tree: Object.keys(files).map((path) => ({
          ...entry(path),
          size: options.size,
          ...options.entries?.[path],
        })),
        truncated: options.truncated ?? false,
      });
    const file = Object.entries(files).find(([path]) =>
      url.endsWith(`/contents/${path}?ref=${commit}`),
    );
    if (file) return new Response(file[1]);
    throw new Error(`Unexpected metadata request: ${url}`);
  };
  return { fetcher, requests };
}

describe("app repository identity", () => {
  test.each([
    [
      ["data/icons/hicolor/scalable/apps/us.hagreli.Planner.svg", "icon.png"],
      "data/icons/hicolor/scalable/apps/us.hagreli.Planner.svg",
    ],
    [
      [
        "data/icons/us.hagreli.Planner-symbolic.svg",
        "data/icons/us.hagreli.Planner.png",
      ],
      "data/icons/us.hagreli.Planner.png",
    ],
    [
      [
        "data/icons/hicolor/32x32/apps/us.hagreli.Planner.png",
        "data/icons/hicolor/128x128/apps/us.hagreli.Planner.png",
      ],
      "data/icons/hicolor/128x128/apps/us.hagreli.Planner.png",
    ],
    [["data/icons/planner.svg", "logo.png"], "data/icons/planner.svg"],
    [["assets/logo.webp"], "assets/logo.webp"],
    [
      ["data/icons/symbolic/apps/us.hagreli.Planner-symbolic.svg"],
      "data/icons/symbolic/apps/us.hagreli.Planner-symbolic.svg",
    ],
    [["data/icon.svg", "icon.svg"], "data/icon.svg"],
    [["data/icons/icon.svg", "data/images/icon.svg"], undefined],
    [
      [
        "screenshots/planner.png",
        "docs/logo.svg",
        "data/icons/actions/icon.svg",
        "data/icons/other-app.svg",
      ],
      undefined,
    ],
    [["tests/icon.svg", "vendor/logo.png", "../icon.svg"], undefined],
  ] as [string[], string | undefined][])(
    "discovers a pinned app icon from repository assets: %j",
    async (paths, selected) => {
      const data = github({
        [path]: metadata,
        ...Object.fromEntries(paths.map((path) => [path, "image bytes"])),
      });
      expect((await resolveAppIdentity(repository, data.fetcher)).icon).toBe(
        selected
          ? `https://raw.githubusercontent.com/mhagrelius/planner/${commit}/${selected}`
          : undefined,
      );
      expect(data.requests).toHaveLength(5);
    },
  );

  test("ignores symlinks and oversized icons without exhausting metadata limits", async () => {
    const data = github(
      {
        [path]: metadata,
        "data/us.hagreli.Planner.svg": "symlink",
        "data/us.hagreli.Planner.png": "oversized",
        "logo.svg": "image",
        ...Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => [
            `data/icons/ui-${i}.svg`,
            "image",
          ]),
        ),
      },
      {
        entries: {
          "data/us.hagreli.Planner.svg": { mode: "120000" },
          "data/us.hagreli.Planner.png": { size: 1024 * 1024 + 1 },
        },
      },
    );
    expect((await resolveAppIdentity(repository, data.fetcher)).icon).toBe(
      `https://raw.githubusercontent.com/mhagrelius/planner/${commit}/logo.svg`,
    );
    expect(data.requests).toHaveLength(5);
  });

  test("finds icons when identity comes from a desktop template", async () => {
    const data = github({
      "data/us.hagreli.Planner.desktop.in":
        "[Desktop Entry]\nType=Application\nIcon=@APP_ID@\n",
      "data/icons/us.hagreli.Planner.svg": "image",
    });
    expect((await resolveAppIdentity(repository, data.fetcher)).icon).toBe(
      `https://raw.githubusercontent.com/mhagrelius/planner/${commit}/data/icons/us.hagreli.Planner.svg`,
    );
  });

  test("includes a custom repository social preview with the app identity", async () => {
    const screenshot =
      "https://repository-images.githubusercontent.com/12345/app-preview.png";
    const data = github(undefined, { screenshot });
    expect(
      (await resolveAppIdentity(repository, data.fetcher)).screenshot,
    ).toBe(screenshot);
  });
  test("normalizes repository roots and rejects unsupported or ambiguous URLs before fetching", async () => {
    expect(appRepository(`${repository}.git/`).url).toBe(repository);
    expect(
      appRepository("https://gitlab.gnome.org/GNOME/Incubator/App").project,
    ).toBe("GNOME/Incubator/App");
    for (const url of [
      "https://example.org/app",
      "http://github.com/owner/app",
      "https://github.com/owner/app/tree/main",
      "https://github.com/owner/app?ref=main",
      "https://github.com/owner/app#readme",
      "https://user:secret@github.com/owner/app",
      "https://github.com:8443/owner/app",
      "https://github.com/owner/../app",
      "https://github.com/owner/%61pp",
      "https://gitlab.com/group/app/-/tree/main",
      "https://127.0.0.1/app",
      "https://gitlab.gnome.org.attacker.org/group/app",
    ]) {
      const data = github();
      await expect(resolveAppIdentity(url, data.fetcher)).rejects.toThrow(
        "repository root URL",
      );
      expect(data.requests).toHaveLength(0);
    }
  });

  test("reads Planner's app ID at one commit without sending credentials or executing source", async () => {
    const data = github();
    expect(await resolveAppIdentity(repository, data.fetcher)).toEqual({
      appId: "us.hagreli.Planner",
      repository,
      commit,
      path,
    });
    expect(appIdentitySlug("us.hagreli.Planner")).toBe("us-hagreli-planner");
    expect(data.requests).toHaveLength(5);
    for (const request of data.requests) {
      expect(new Headers(request.init?.headers).has("Authorization")).toBe(
        false,
      );
      expect(request.init?.redirect).toBe("error");
      expect(request.init?.signal).toBeDefined();
    }
  });

  test("prefers AppStream to helper desktop launchers and ignores test fixtures", async () => {
    const data = github({
      [path]: metadata,
      "data/org.example.Helper.desktop": "[Desktop Entry]\nType=Application\n",
      "tests/org.example.Fake.metainfo.xml": metadata.replaceAll(
        "us.hagreli.Planner",
        "org.example.Fake",
      ),
    });
    expect((await resolveAppIdentity(repository, data.fetcher)).appId).toBe(
      "us.hagreli.Planner",
    );
    expect(data.requests).toHaveLength(5);
  });

  test("supports AppStream templates and desktop file fallback without evaluating expressions", async () => {
    expect(
      metadataAppIds(
        "data/us.hagreli.Planner.metainfo.xml.in",
        metadata.replace("us.hagreli.Planner", "@APP_ID@"),
      ),
    ).toEqual(["us.hagreli.Planner"]);
    expect(
      metadataAppIds(
        "data/app.metainfo.xml.in",
        metadata.replace("us.hagreli.Planner", "@APP_ID@"),
      ),
    ).toEqual([]);
    const data = github({
      "data/us.hagreli.Planner.desktop.in":
        "[Desktop Entry]\nType=Application\nExec=planner\n[Desktop Action New]\nName=New task\n",
    });
    expect((await resolveAppIdentity(repository, data.fetcher)).appId).toBe(
      "us.hagreli.Planner",
    );
    expect(
      metadataAppIds(
        "data/us.hagreli.Planner.desktop",
        "[Desktop Entry]\nType=Link\nURL=https://example.org",
      ),
    ).toEqual([]);
    expect(
      metadataAppIds(
        path,
        metadata.replace("us.hagreli.Planner", "us.hagreli.Planner.desktop"),
      ),
    ).toEqual(["us.hagreli.Planner"]);
    expect(
      metadataAppIds(
        path,
        `<!-- <component type="desktop-application"><id>org.example.Fake</id></component> -->${metadata}`,
      ),
    ).toEqual(["us.hagreli.Planner"]);
  });

  test("rejects absent, ambiguous, incomplete, or oversized metadata", async () => {
    for (const data of [
      github({}),
      github({ [path]: metadata.replace("us.hagreli.Planner", "@APP_ID@") }),
      github({
        [path]: metadata,
        "data/org.example.Other.metainfo.xml": metadata.replace(
          "us.hagreli.Planner",
          "org.example.Other",
        ),
      }),
      github({ [path]: metadata }, { truncated: true }),
      github({ [path]: metadata }, { size: 300_000 }),
      github({ [path]: " ".repeat(300_000) }),
      github({
        [path]: metadata.replace(
          "</component>",
          "<id>org.example.Other</id></component>",
        ),
      }),
      github({
        [path]: `<!DOCTYPE component [<!ENTITY id SYSTEM "file:///etc/passwd">]>${metadata}`,
      }),
    ])
      await expect(
        resolveAppIdentity(repository, data.fetcher),
      ).rejects.toThrow();
    for (const status of [301, 404, 429, 500])
      await expect(
        resolveAppIdentity(repository, github(undefined, { status }).fetcher),
      ).rejects.toThrow(`(${status})`);
  });

  test.each(["gitlab.com", "gitlab.gnome.org"])(
    "pins GitLab metadata and icons with bounded pagination on %s",
    async (host) => {
      const urls: string[] = [];
      const repo = `https://${host}/GNOME/Apps/Planner`;
      const api = `https://${host}/api/v4/projects/GNOME%2FApps%2FPlanner`;
      const iconPath =
        "data/icons/hicolor/scalable/apps/us.hagreli.Planner.svg";
      const fetcher = async (url: string) => {
        urls.push(url);
        if (url === api) return Response.json({ default_branch: "main" });
        if (url.endsWith("/commits/main")) return Response.json({ id: commit });
        if (url.endsWith("&page=1"))
          return Response.json(
            Array.from({ length: 100 }, (_, i) => entry(`src/file${i}.rs`)),
          );
        if (url.endsWith("&page=2"))
          return Response.json([entry(path), entry(iconPath)]);
        if (
          url ===
          `${api}/repository/files/${encodeURIComponent(path)}/raw?ref=${commit}`
        )
          return new Response(metadata);
        throw new Error(`Unexpected URL: ${url}`);
      };
      expect(await resolveAppIdentity(repo, fetcher)).toEqual({
        appId: "us.hagreli.Planner",
        repository: repo,
        commit,
        path,
        icon: `${repo}/-/raw/${commit}/${iconPath}`,
      });
      expect(urls).toContain(
        `${api}/repository/tree?ref=${commit}&recursive=true&per_page=100&page=2`,
      );
    },
  );
});
