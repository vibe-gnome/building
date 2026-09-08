import { appRepository } from "../lib/app-identity";
import {
  type RepositoryFetcher,
  readRepositoryText,
} from "./repository-metadata";

export async function repositoryScreenshot(
  repository: string,
  fetcher: RepositoryFetcher = fetch,
): Promise<string | undefined> {
  const repo = appRepository(repository);
  if (repo.host !== "github.com") return undefined;
  try {
    const html = await readRepositoryText(
      repo.url,
      fetcher,
      2 * 1024 * 1024,
      "text/html",
    );
    const images = new Set<string>();
    await new HTMLRewriter()
      .on('head meta[property="og:image"]', {
        element(element) {
          const value = element.getAttribute("content");
          if (value) images.add(value);
        },
      })
      .transform(new Response(html))
      .text();
    if (images.size !== 1) return undefined;
    const image = new URL([...images][0] ?? "");
    // Uploaded previews use this CDN; generated repository cards are not screenshots.
    if (
      image.protocol !== "https:" ||
      image.hostname !== "repository-images.githubusercontent.com" ||
      image.username ||
      image.password ||
      image.port ||
      image.hash ||
      !/^\/\d+\/[a-zA-Z0-9._-]+$/.test(image.pathname)
    )
      return undefined;
    return image.href;
  } catch {
    // Social previews are optional; their availability must not block identity discovery.
    return undefined;
  }
}
