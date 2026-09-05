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
