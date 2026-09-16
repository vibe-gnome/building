import type { ExtensionListing } from "./extension-catalog";

export const site = {
  home: "/",
  repository: "https://github.com/vibe-gnome/building",
  gnome: "https://extensions.gnome.org/",
  guidelines:
    "https://gjs.guide/extensions/review-guidelines/review-guidelines.html",
};

export function issueUrl(
  action: "submit" | "remove",
  entry?: ExtensionListing,
) {
  const url = new URL(`${site.repository}/issues/new`);
  url.searchParams.set("template", `${action}-extension.yml`);
  if (entry) {
    url.searchParams.set("title", `[Remove] ${entry.metadata.name}`);
    url.searchParams.set("extension-name", entry.metadata.name);
    url.searchParams.set("repository", entry.source);
  }
  return url.href;
}
