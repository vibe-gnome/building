import type { ExtensionListing } from "./extension-catalog";

export const site = {
  home: "/",
  repository: "https://github.com/vibe-gnome/building",
  reddit: "https://www.reddit.com/r/vibe_gnome/",
  gnome: "https://extensions.gnome.org/",
  guidelines:
    "https://gjs.guide/extensions/review-guidelines/review-guidelines.html",
};

export function issueUrl(
  action: "submit" | "update" | "remove",
  entry?: ExtensionListing,
) {
  const url = new URL(`${site.repository}/issues/new`);
  url.searchParams.set("template", `${action}-extension.yml`);
  if (entry) {
    url.searchParams.set(
      "title",
      `[${action === "update" ? "Update" : "Remove"}] ${entry.metadata.name}`,
    );
    url.searchParams.set("extension-name", entry.metadata.name);
    url.searchParams.set("uuid", entry.metadata.uuid);
    url.searchParams.set("repository", entry.source);
  }
  return url.href;
}
