import { useEffect, useState } from "react";
import { type BadgeProject, loadBadgeProjects } from "./badge-projects";

export type BadgeProjectsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; projects: readonly BadgeProject[] };

export function useBadgeProjects() {
  const [state, setState] = useState<BadgeProjectsState>({ status: "loading" });

  useEffect(() => {
    if (state.status !== "loading") return;
    const controller = new AbortController();
    loadBadgeProjects(controller.signal).then(
      (projects) => {
        if (!controller.signal.aborted) setState({ status: "ready", projects });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [state.status]);

  return { state, retry: () => setState({ status: "loading" }) };
}
