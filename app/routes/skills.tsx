import { ToolPage } from "../components/tool-page";

export function meta() {
  return [
    { title: "Skills | Vibe Tools | Vibe GNOME" },
    {
      name: "description",
      content:
        "Discover community-submitted agent skills for building GNOME software.",
    },
  ];
}

export default function Skills() {
  return <ToolPage category="skills" />;
}
