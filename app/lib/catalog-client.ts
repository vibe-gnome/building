import type { ListingCategory, ListingTypes } from "./listings";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function catalogResponse(
  path: string,
  signal: AbortSignal,
  fetcher: Fetcher,
) {
  const response = await fetcher(path, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (
    !response.ok ||
    !response.headers.get("Content-Type")?.includes("application/json")
  ) {
    throw new Response(
      "The catalog is temporarily unavailable. Please try again.",
      { status: 503 },
    );
  }
  return response.json();
}

export async function loadCatalog<C extends ListingCategory>(
  category: C,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<ListingTypes[C][]> {
  const entries: ListingTypes[C][] = [];
  let after = "";
  do {
    const page = await catalogResponse(
      `/api/catalog/${category}${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      signal,
      fetcher,
    );
    if (
      !page ||
      page.category !== category ||
      !Array.isArray(page.entries) ||
      (page.next !== null &&
        (typeof page.next !== "string" || page.next <= after))
    ) {
      throw new Response("Invalid catalog response.", { status: 503 });
    }
    entries.push(...page.entries);
    after = page.next ?? "";
  } while (after);
  return entries;
}

export async function loadListing<C extends ListingCategory>(
  category: C,
  slug: string,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<ListingTypes[C] | null> {
  const data = await catalogResponse(
    `/api/catalog/${category}/${encodeURIComponent(slug)}`,
    signal,
    fetcher,
  );
  if (!data) return null;
  const id = data.entry?.slug ?? data.entry?.id;
  if (data.category !== category || id !== slug)
    throw new Response("Invalid listing response.", { status: 503 });
  return data.entry;
}
