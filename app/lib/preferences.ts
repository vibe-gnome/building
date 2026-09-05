export const themeModes = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];

export const accentNames = [
  "blue",
  "teal",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "slate",
] as const;
export type AccentName = (typeof accentNames)[number];

export function normalizeTheme(value: string | null): ThemeMode {
  return themeModes.includes(value as ThemeMode)
    ? (value as ThemeMode)
    : "system";
}

export function normalizeAccent(value: string | null): AccentName {
  return accentNames.includes(value as AccentName)
    ? (value as AccentName)
    : "teal";
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean) {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

export const prompts = {
  app: `Help me create a polished GNOME desktop app.

Before writing code, ask me:
1. What problem the app solves and who it is for
2. Which language I prefer (suggest JavaScript, Rust, Python, or Vala)
3. The minimum GNOME version I need to support

Then propose a small, production-ready plan using GTK 4 and Libadwaita. Follow the GNOME Human Interface Guidelines, use adaptive layouts, system accent colors, light/dark styles, symbolic icons, and accessible labels. Include the project structure, exact setup commands, complete files, local testing steps, Flatpak packaging, and a short checklist to verify the result on GNOME. Explain unfamiliar GNOME concepts as we go.`,
  extension: `Help me create a polished GNOME Shell extension.

Before writing code, ask me:
1. What desktop behavior I want to add or change
2. Which GNOME Shell versions I need to support
3. Whether the extension needs preferences

Then propose a small, production-ready plan using modern GJS and ES modules. Follow current GNOME Shell extension conventions, keep shell changes reversible, avoid blocking the main loop, and use accessible labels. Include metadata.json, complete source files, exact install and reload commands, Looking Glass and journalctl debugging steps, version compatibility notes, and a checklist for publishing to extensions.gnome.org. Explain unfamiliar GNOME concepts as we go.`,
} as const;

export type PromptKind = keyof typeof prompts;
