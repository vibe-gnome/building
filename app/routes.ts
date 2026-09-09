import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("guides", "routes/guides-layout.tsx", [index("routes/guides.tsx")]),
  route("apps", "routes/apps-layout.tsx", [
    index("routes/apps.tsx"),
    route(":dbId/:slug?", "routes/app.tsx"),
  ]),
  route("extensions", "routes/extensions-layout.tsx", [
    index("routes/extensions.tsx"),
    route(":dbId/:slug?", "routes/extension.tsx"),
    route("*", "routes/extensions-not-found.tsx"),
  ]),
  route("skills", "routes/skills-layout.tsx", [
    index("routes/skills.tsx"),
    route(":dbId/:slug?", "routes/skill.tsx"),
  ]),
] satisfies RouteConfig;
