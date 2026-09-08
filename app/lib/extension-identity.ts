import type { ExtensionListing } from "./extension-catalog";

export interface ExtensionIdentity {
  metadata: ExtensionListing["metadata"];
  repository: string;
  commit: string;
  path: string;
  icon?: string;
  screenshot?: string;
}
