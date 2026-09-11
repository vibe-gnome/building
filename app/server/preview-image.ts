import { imageSize } from "image-size";
import {
  type RepositoryFetcher,
  readResponseBytes,
} from "./repository-metadata";

export const minimumPreviewWidth = 480;
export const minimumPreviewHeight = 270;
export const maximumPreviewBytes = 5 * 1024 * 1024;

/** Only call with a URL selected from a repository snapshot or an allowed CDN. */
export async function isPreviewImage(
  url: string,
  fetcher: RepositoryFetcher,
  signal = AbortSignal.timeout(10_000),
) {
  try {
    const response = await fetcher(url, {
      redirect: "error",
      credentials: "omit",
      signal,
      headers: {
        Accept: "image/png,image/jpeg,image/webp,image/gif",
        "User-Agent": "vibe-gnome-listing-review",
      },
    });
    if (
      !response.ok ||
      Number(response.headers.get("Content-Length")) > maximumPreviewBytes
    ) {
      await response.body?.cancel();
      return false;
    }
    // Inspect the bytes, never the filename, Content-Type, or README dimensions.
    const size = imageSize(
      await readResponseBytes(response, maximumPreviewBytes),
    );
    return (
      ["png", "jpg", "webp", "gif"].includes(size.type ?? "") &&
      size.width >= minimumPreviewWidth &&
      size.height >= minimumPreviewHeight
    );
  } catch {
    // Optional images must not prevent a valid app or extension from being reviewed.
    return false;
  }
}
