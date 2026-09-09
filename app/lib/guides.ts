import { listingPath } from "./listing-links";
import type { ToolEntry } from "./tools";

export interface GuideEntry {
  id: string;
  kind: "Doc" | "Skill";
  title: string;
  description: string;
  href: string;
  source?: string;
}

export const guideArticles: readonly GuideEntry[] = [
  {
    id: "vibe-learning",
    kind: "Doc",
    title: "Vibing a GNOME Extension When You Know Nothing About GNOME",
    description:
      "Building a speech-to-text extension with AI, with lessons on GNOME APIs, debugging, and learning as you go.",
    href: "https://kaveh.page/blog/vibe-learning",
    source: "kaveh.page",
  },
];

export function skillGuides(skills: readonly ToolEntry[]): GuideEntry[] {
  return [...skills]
    .sort(
      (a, b) =>
        (b.dbId ?? 0) - (a.dbId ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .map((skill) => ({
      id: skill.id,
      kind: "Skill",
      title: skill.name,
      description: skill.description,
      href: listingPath("skills", skill),
    }));
}
