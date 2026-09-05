import type { Config } from "@react-router/dev/config";
import extensions from "./app/data/extensions.json";

export default {
  ssr: false,
  prerender: [
    "/about",
    "/apps",
    "/extensions",
    "/skills",
    ...extensions.map((entry) => `/extensions/${entry.slug}`),
  ],
} satisfies Config;
