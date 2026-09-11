export type ToolCategory = "skills";

export interface ToolEntry {
  dbId?: number;
  id: string;
  name: string;
  description: string;
  href: string;
  bestFor?: string;
  tags?: readonly string[];
}

interface ToolCollection {
  title: string;
  description: string;
}

export const toolCollections: Record<ToolCategory, ToolCollection> = {
  skills: {
    title: "Skills",
    description: "Reusable agent guidance for reliable GNOME builds.",
  },
};
