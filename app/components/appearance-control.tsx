import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dismissDetailsFromOutsideTarget } from "../lib/details";
import {
  type AccentName,
  accentNames,
  normalizeAccent,
  normalizeTheme,
  resolveTheme,
  type ThemeMode,
  themeModes,
} from "../lib/preferences";

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;

export function AppearanceControl() {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [accent, setAccent] = useState<AccentName>("teal");
  const controlRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const storedTheme = normalizeTheme(localStorage.getItem("vibe-theme"));
    const storedAccent = normalizeAccent(localStorage.getItem("vibe-accent"));
    setTheme(storedTheme);
    setAccent(storedAccent);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(
        normalizeTheme(localStorage.getItem("vibe-theme")),
        media.matches,
      );
    };

    applySystemTheme();
    media.addEventListener("change", applySystemTheme);
    return () => media.removeEventListener("change", applySystemTheme);
  }, []);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      dismissDetailsFromOutsideTarget(
        controlRef.current,
        event.target instanceof Node ? event.target : null,
      );
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && controlRef.current?.open) {
        controlRef.current.open = false;
        controlRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointerDown,
        true,
      );
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function chooseTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    localStorage.setItem("vibe-theme", nextTheme);
    document.documentElement.dataset.theme = resolveTheme(
      nextTheme,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }

  function chooseAccent(nextAccent: AccentName) {
    setAccent(nextAccent);
    localStorage.setItem("vibe-accent", nextAccent);
    document.documentElement.dataset.accent = nextAccent;
  }

  return (
    <details className="appearance-control" ref={controlRef}>
      <summary aria-label="Change appearance" title="Change appearance">
        <Palette aria-hidden="true" size={18} />
      </summary>
      <div className="appearance-popover">
        <div>
          <p className="control-label">Style</p>
          <fieldset aria-label="Color scheme" className="theme-options">
            {themeModes.map((mode) => {
              const Icon = themeIcons[mode];
              return (
                <button
                  className="theme-option"
                  data-active={theme === mode}
                  aria-pressed={theme === mode}
                  key={mode}
                  onClick={() => chooseTheme(mode)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={17} />
                  {mode[0]?.toUpperCase()}
                  {mode.slice(1)}
                </button>
              );
            })}
          </fieldset>
        </div>
        <div>
          <p className="control-label">Accent color</p>
          <fieldset aria-label="Accent color" className="accent-options">
            {accentNames.map((name) => (
              <button
                aria-label={name}
                aria-pressed={accent === name}
                className="accent-swatch"
                data-color={name}
                key={name}
                onClick={() => chooseAccent(name)}
                title={name}
                type="button"
              >
                {accent === name ? (
                  <Check aria-hidden="true" size={15} />
                ) : null}
              </button>
            ))}
          </fieldset>
        </div>
      </div>
    </details>
  );
}
