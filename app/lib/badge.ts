export const badgeLabel = "Listed on Vibe GNOME";
export const badgeSiteUrl = "https://vibe-gnome.org";
export const badgeVariants = ["light", "dark"] as const;
export type BadgeVariant = (typeof badgeVariants)[number];
export type BadgeFormat = "markdown" | "html";

export function badgePath(variant: BadgeVariant) {
  return `/badges/listed-on-vibe-gnome-${variant}.svg`;
}

export function badgeSnippet(variant: BadgeVariant, format: BadgeFormat) {
  const source = `${badgeSiteUrl}${badgePath(variant)}`;
  if (format === "markdown") {
    return `[![${badgeLabel}](${source})](${badgeSiteUrl})`;
  }
  return `<a href="${badgeSiteUrl}">\n  <img\n    src="${source}"\n    alt="${badgeLabel}"\n    width="228" height="64"\n  />\n</a>`;
}
