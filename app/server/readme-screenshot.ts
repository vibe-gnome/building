import { marked } from "marked";
import { appRepository } from "../lib/app-identity";
import { isPreviewImage, maximumPreviewBytes } from "./preview-image";
import type {
  RepositoryFetcher,
  repositoryMetadata,
} from "./repository-metadata";

type Snapshot = Awaited<ReturnType<typeof repositoryMetadata>>;
const readmePaths = [
  /^(?:readme)(?:\.md|\.markdown)?$/i,
  /^\.github\/readme(?:\.md|\.markdown)?$/i,
  /^docs\/readme(?:\.md|\.markdown)?$/i,
];
const branding =
  /(?:^|[\s/_.-])(?:badges?|icons?|logos?|avatars?)(?:$|[\s/_.-])/i;

function imageUrl(value: string, readme: string, snapshot: Snapshot) {
  if (
    !value ||
    value.length > 2048 ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return undefined;
  try {
    const repo = appRepository(snapshot.repository);
    const base = `https://readme.invalid/${readme.split("/").map(encodeURIComponent).join("/")}`;
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return undefined;
    const local = url.origin === "https://readme.invalid";
    const prefixes =
      repo.host === "github.com"
        ? [
            `https://raw.githubusercontent.com/${repo.project}/`,
            `${repo.url}/blob/`,
            `${repo.url}/raw/`,
          ]
        : [`${repo.url}/-/blob/`, `${repo.url}/-/raw/`];
    const prefix = prefixes.find((prefix) => url.href.startsWith(prefix));
    if (local || prefix) {
      let path = decodeURIComponent(url.pathname.slice(1));
      if (prefix) {
        const relative = decodeURIComponent(
          url.href.slice(prefix.length).split(/[?#]/)[0] ?? "",
        );
        const revision = [snapshot.commit, snapshot.defaultBranch].find((ref) =>
          relative.startsWith(`${ref}/`),
        );
        if (!revision) return undefined;
        path = relative.slice(revision.length + 1);
      }
      const file = snapshot.files.find((file) => file.path === path);
      if (!file || (file.size !== undefined && file.size > maximumPreviewBytes))
        return undefined;
      return snapshot.rawFileUrl(file);
    }
    // Public GitHub uploads are common in READMEs. Arbitrary external hosts and
    // redirects are skipped so repository content cannot choose network targets.
    if (
      [
        "user-images.githubusercontent.com",
        "repository-images.githubusercontent.com",
      ].includes(url.hostname) &&
      /^\/\d+\/[a-zA-Z0-9._-]+$/.test(url.pathname) &&
      !url.search
    ) {
      url.hash = "";
      return url.href;
    }
  } catch {
    // Malformed links are just ineligible images.
  }
  return undefined;
}

export async function readmeScreenshot(
  snapshot: Snapshot,
  fetcher: RepositoryFetcher,
): Promise<string | undefined> {
  const seen = new Set<string>();
  const signal = AbortSignal.timeout(30_000);
  for (const pattern of readmePaths) {
    const readme = snapshot.files.find((file) => pattern.test(file.path));
    if (!readme || signal.aborted) continue;
    try {
      const source = await snapshot.readFile(readme);
      const images: string[] = [];
      // Markdown parsing handles reference/linked images and ignores code fences.
      // HTMLRewriter only inspects attributes; this HTML is never rendered or run.
      await new HTMLRewriter()
        .on("img", {
          element(element) {
            const src = element.getAttribute("src") ?? "";
            const alt = element.getAttribute("alt") ?? "";
            if (branding.test(`${alt} ${src.split(/[?#]/)[0]}`)) return;
            const url = imageUrl(src, readme.path, snapshot);
            if (url && !seen.has(url) && seen.size < 8) {
              seen.add(url);
              images.push(url);
            }
          },
        })
        .transform(new Response(marked.parse(source, { async: false })))
        .text();
      for (const url of images) {
        if (signal.aborted) return undefined;
        if (
          await isPreviewImage(
            url,
            fetcher,
            AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
          )
        )
          return url;
      }
      if (seen.size >= 8) return undefined;
    } catch {
      // A missing, oversized, or unreadable README does not block discovery.
    }
  }
  return undefined;
}
