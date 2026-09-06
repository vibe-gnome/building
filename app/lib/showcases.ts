export type ShowcaseCategory = "apps" | "extensions";

export interface ShowcaseEntry {
  id: string;
  href: string;
  name: string;
  summary: string;
  submittedBy: string;
  tags: readonly string[];
}

export interface ShowcaseCollection {
  description: string;
  eyebrow: string;
}

export const showcaseCollections: Record<ShowcaseCategory, ShowcaseCollection> =
  {
    apps: {
      eyebrow: "App showcase",
      description:
        "Community-built desktop tools shaped around GTK, Libadwaita, and focused workflows.",
    },
    extensions: {
      eyebrow: "Extension showcase",
      description:
        "Focused GNOME Shell extensions submitted by people improving one desktop behavior at a time.",
    },
  };

export function showcaseSubmissionUrl(category: ShowcaseCategory) {
  const url = new URL("https://github.com/vibe-gnome/building/issues/new");
  url.searchParams.set(
    "template",
    category === "apps" ? "submit-app.yml" : "submit-extension.yml",
  );
  return url.href;
}
