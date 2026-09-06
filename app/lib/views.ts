import type { ListingCategory } from "./listings";

export async function recordView(
  category: ListingCategory,
  slug: string,
  fetcher: (input: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<number> {
  const response = await fetcher(
    `/api/views/${category}/${encodeURIComponent(slug)}`,
    {
      method: "POST",
      headers: { "X-Vibe-View": "1" },
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("View count unavailable");
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("views" in data) ||
    typeof data.views !== "number" ||
    !Number.isSafeInteger(data.views) ||
    data.views < 0 ||
    !("category" in data) ||
    data.category !== category ||
    !("slug" in data) ||
    data.slug !== slug
  ) {
    throw new Error("Invalid view count response");
  }
  return data.views;
}
