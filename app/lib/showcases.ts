export type ShowcaseCategory = "apps" | "extensions";

export interface ShowcaseEntry {
  name: string;
  summary: string;
  submittedBy: string;
  tags: readonly string[];
}

export interface ShowcaseCollection {
  description: string;
  eyebrow: string;
  entries: readonly ShowcaseEntry[];
}

export const showcaseCollections: Record<ShowcaseCategory, ShowcaseCollection> =
  {
    apps: {
      eyebrow: "App showcase",
      description:
        "Community-built desktop tools shaped around GTK, Libadwaita, and focused workflows.",
      entries: [],
    },
    extensions: {
      eyebrow: "Extension showcase",
      description:
        "Focused GNOME Shell extensions submitted by people improving one desktop behavior at a time.",
      entries: [],
    },
  };

export function showcaseSubmissionUrl(category: ShowcaseCategory) {
  const url = new URL("https://github.com/vibe-gnome/website/issues/new");
  url.searchParams.set(
    "template",
    category === "apps" ? "submit-app.yml" : "submit-extension.yml",
  );
  return url.href;
}
