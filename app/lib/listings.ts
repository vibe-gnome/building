import type { ExtensionListing } from "./extension-catalog";
import type { ShowcaseEntry } from "./showcases";
import type { ToolEntry } from "./tools";

export type ListingCategory = "apps" | "extensions" | "skills";

export function isListingCategory(value: string): value is ListingCategory {
  return value === "apps" || value === "extensions" || value === "skills";
}

export interface ListingTypes {
  apps: ShowcaseEntry;
  extensions: ExtensionListing;
  skills: ToolEntry;
}

export type CatalogListing = ListingTypes[ListingCategory];

export function isListingSlug(value: string) {
  return value.length <= 128 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
