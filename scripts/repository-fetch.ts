import type { RepositoryFetcher } from "../app/server/repository-metadata";

export function createRepositoryFetcher(
  token: string,
  fetcher: RepositoryFetcher = fetch,
): RepositoryFetcher {
  return (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init?.headers);
    headers.delete("Authorization");
    headers.set("User-Agent", "vibe-gnome-listing-review");
    if (
      url.origin === "https://api.github.com" &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith("/repos/")
    ) {
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("X-GitHub-Api-Version", "2022-11-28");
    }
    return fetcher(input, { ...init, headers, redirect: "error" });
  };
}
