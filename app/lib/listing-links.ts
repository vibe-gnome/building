import type { CatalogListing, ListingCategory } from "./listings";

export function isListingDbId(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

export function listingNameId(entry: CatalogListing): string {
  let name: string;
  if ("metadata" in entry) {
    name = entry.metadata.uuid.split("@")[0] ?? entry.metadata.name;
  } else if ("summary" in entry) {
    name = entry.appId?.split(".").at(-1) ?? entry.name;
  } else {
    const url = new URL(entry.href);
    name = /^(www\.)?skills\.sh$/.test(url.hostname)
      ? (url.pathname.split("/").filter(Boolean).at(-1) ?? entry.name)
      : entry.name;
  }
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 128)
      .replace(/^-+|-+$/g, "") || "listing"
  );
}

export function listingPath(category: ListingCategory, entry: CatalogListing) {
  if (!isListingDbId(String(entry.dbId)))
    throw new Error("A database ID is required for a listing link.");
  return `/${category}/${entry.dbId}/${listingNameId(entry)}`;
}
