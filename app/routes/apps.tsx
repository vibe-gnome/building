import { ShowcasePage } from "../components/showcase-page";

export function meta() {
  return [
    { title: "App showcase — Vibe GNOME" },
    {
      name: "description",
      content: "Discover community-submitted GNOME apps built with AI agents.",
    },
  ];
}

export default function Apps() {
  return <ShowcasePage category="apps" />;
}
