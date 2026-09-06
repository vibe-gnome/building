import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("apps", "routes/apps-layout.tsx", [
    index("routes/apps.tsx"),
    route(":slug", "routes/app.tsx"),
  ]),
  route("extensions", "routes/extensions-layout.tsx", [
    index("routes/extensions.tsx"),
    route(":slug", "routes/extension.tsx"),
    route("*", "routes/extensions-not-found.tsx"),
  ]),
  route("skills", "routes/skills-layout.tsx", [
    index("routes/skills.tsx"),
    route(":slug", "routes/skill.tsx"),
  ]),
] satisfies RouteConfig;
