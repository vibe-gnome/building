export type ToolCategory = "skills";

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  bestFor?: string;
}

interface ToolCollection {
  title: string;
  description: string;
  submitLabel: string;
  issueTemplate: string;
  recommended: readonly ToolEntry[];
  entries: readonly ToolEntry[];
}

export const toolCollections: Record<ToolCategory, ToolCollection> = {
  skills: {
    title: "Skills",
    description: "Reusable agent guidance for reliable GNOME builds.",
    submitLabel: "Submit a skill",
    issueTemplate: "submit-skill.yml",
    recommended: [],
    entries: [],
  },
};

export function toolSubmissionUrl(category: ToolCategory): string {
  const url = new URL("https://github.com/vibe-gnome/building/issues/new");
  url.searchParams.set("template", toolCollections[category].issueTemplate);
  return url.href;
}
