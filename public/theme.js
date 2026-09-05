// Apply saved appearance preferences before React hydrates the page.
try {
  const mode = localStorage.getItem("vibe-theme") || "system";
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = mode === "dark" || (mode === "system" && prefersDark);

  document.documentElement.dataset.theme = useDark ? "dark" : "light";
  document.documentElement.dataset.accent =
    localStorage.getItem("vibe-accent") || "teal";
} catch {
  // Storage can be unavailable in privacy-restricted browser contexts.
}
