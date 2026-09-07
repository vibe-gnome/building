import { replace } from "react-router";
import {
  type CatalogFetcher,
  loadListing,
  loadListingById,
} from "./catalog-client";
import { isListingDbId, listingPath } from "./listing-links";
import { isListingSlug, type ListingCategory } from "./listings";

export async function loadListingPage<C extends ListingCategory>(
  category: C,
  params: { dbId: string; slug?: string },
  request: Request,
  fetcher: CatalogFetcher = fetch,
) {
  const { dbId, slug } = params;
  // Single-segment URLs were originally catalog keys, including numeric keys.
  // Prefer those legacy records before treating a single number as a DB ID.
  let entry =
    slug === undefined && isListingSlug(dbId)
      ? await loadListing(category, dbId, request.signal, fetcher)
      : null;
  if (!entry && isListingDbId(dbId))
    entry = await loadListingById(
      category,
      Number(dbId),
      request.signal,
      fetcher,
    );
  if (!entry) return null;
  const url = new URL(request.url);
  const path = listingPath(category, entry);
  if (url.pathname !== path) throw replace(`${path}${url.search}${url.hash}`);
  return entry;
}
