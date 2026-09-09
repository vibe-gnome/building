import { useEffect, useState } from "react";
import { loadCatalog } from "./catalog-client";
import type { ToolEntry } from "./tools";

export type GuideSkillsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: readonly ToolEntry[] };

export function useGuideSkills() {
  const [state, setState] = useState<GuideSkillsState>({ status: "loading" });

  useEffect(() => {
    if (state.status !== "loading") return;
    const controller = new AbortController();
    loadCatalog("skills", controller.signal).then(
      (entries) => {
        if (!controller.signal.aborted) setState({ status: "ready", entries });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [state.status]);

  const retry = () => {
    setState({ status: "loading" });
  };

  return { state, retry };
}
