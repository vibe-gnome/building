import { type CSSProperties, useEffect, useRef, useState } from "react";

const ideas = [
  {
    id: "clipboard",
    title: "Clipboard shelf",
    kind: "App",
    text: "A searchable clipboard shelf for recent text, links, and images.",
    x: 14,
    y: 21,
    mobileX: 16,
    mobileY: 17,
    rotation: -24,
  },
  {
    id: "focus",
    title: "A little room to focus",
    kind: "Extension",
    text: "A Quick Settings timer for focused work and intentional breaks.",
    x: 39,
    y: 13,
    mobileX: 46,
    mobileY: 11,
    rotation: 18,
  },
  {
    id: "voice",
    title: "Voice-note inbox",
    kind: "App",
    text: "A local voice-note inbox that transcribes and tags recordings.",
    x: 68,
    y: 19,
    mobileX: 83,
    mobileY: 19,
    rotation: -12,
  },
  {
    id: "windows",
    title: "Windows that remember",
    kind: "Extension",
    text: "A window rule helper that remembers where specific apps belong.",
    x: 88,
    y: 32,
    mobileX: 65,
    mobileY: 29,
    rotation: 32,
  },
  {
    id: "images",
    title: "Drop, rename, done",
    kind: "App",
    text: "A simple drop zone that batch-renames and converts images.",
    x: 11,
    y: 72,
    mobileX: 13,
    mobileY: 72,
    rotation: -36,
  },
  {
    id: "privacy",
    title: "Know when you're live",
    kind: "Extension",
    text: "A panel indicator that makes microphone and camera use obvious.",
    x: 36,
    y: 84,
    mobileX: 39,
    mobileY: 85,
    rotation: 12,
  },
  {
    id: "photos",
    title: "Keep the good shots",
    kind: "App",
    text: "A local photo culler that groups similar shots and keeps every decision offline.",
    x: 67,
    y: 76,
    mobileX: 68,
    mobileY: 71,
    rotation: -18,
  },
  {
    id: "scratchpad",
    title: "A note for every workspace",
    kind: "Extension",
    text: "A workspace scratchpad that keeps one small note attached to each desktop.",
    x: 88,
    y: 86,
    mobileX: 86,
    mobileY: 85,
    rotation: 27,
  },
] as const;

type FootprintStyle = CSSProperties & {
  "--idea-desktop-x": string;
  "--idea-desktop-y": string;
  "--idea-mobile-x": string;
  "--idea-mobile-y": string;
  "--idea-rotation": string;
};

export function IdeaFootprints() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !listRef.current?.contains(event.target)
      ) {
        setActiveId(null);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveId(null);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  return (
    <ul
      aria-label="Vibe coding ideas"
      className="idea-footprints"
      id="paths"
      ref={listRef}
    >
      {ideas.map((idea) => {
        const isOpen = activeId === idea.id;
        const cardId = `idea-${idea.id}`;
        // Scatter within safe zones so marks never sit over the slogan.
        const style: FootprintStyle = {
          "--idea-desktop-x": `${idea.x}%`,
          "--idea-desktop-y": `${idea.y}%`,
          "--idea-mobile-x": `${idea.mobileX}%`,
          "--idea-mobile-y": `${idea.mobileY}%`,
          "--idea-rotation": `${idea.rotation}deg`,
        };

        return (
          <li
            data-kind={idea.kind.toLowerCase()}
            data-open={isOpen}
            data-side={idea.y > 50 ? "above" : "below"}
            key={idea.id}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setActiveId((current) =>
                  current === idea.id ? null : current,
                );
              }
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setActiveId(idea.id);
            }}
            onPointerLeave={(event) => {
              if (
                event.pointerType === "mouse" &&
                !event.currentTarget.querySelector(":focus-visible")
              ) {
                setActiveId((current) =>
                  current === idea.id ? null : current,
                );
              }
            }}
            style={style}
          >
            <button
              aria-controls={cardId}
              aria-describedby={isOpen ? `${cardId}-description` : undefined}
              aria-expanded={isOpen}
              aria-label={`${idea.kind} idea: ${idea.title}`}
              className="idea-footprint-button"
              onClick={() => setActiveId(idea.id)}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible"))
                  setActiveId(idea.id);
              }}
              type="button"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                shapeRendering="crispEdges"
                viewBox="0 0 1024 1024"
              >
                <use href="/logo.svg#paw-print" />
              </svg>
            </button>
            <div aria-hidden={!isOpen} className="idea-popover" id={cardId}>
              <div className="idea-popover-card">
                <span className="small-label">{idea.kind}</span>
                <h2>{idea.title}</h2>
                <p id={`${cardId}-description`}>{idea.text}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
