import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  prerender: ["/about", "/apps", "/extensions", "/skills", "/guides"],
} satisfies Config;
