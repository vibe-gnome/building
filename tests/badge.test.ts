import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { marked } from "marked";
import {
  badgeLabel,
  badgePath,
  badgeSiteUrl,
  badgeSnippet,
  badgeVariants,
} from "../app/lib/badge";

describe("portable listing badge", () => {
  for (const variant of badgeVariants) {
    test(`${variant} embeds reference a self-contained public SVG`, async () => {
      const source = `${badgeSiteUrl}${badgePath(variant)}`;
      const svg = await Bun.file(
        resolve(import.meta.dir, `../public${badgePath(variant)}`),
      ).text();
      expect(svg).toContain('viewBox="0 0 228 64"');
      expect(svg).toContain(`<title id="title">${badgeLabel}</title>`);
      expect(svg).not.toMatch(/<(script|image|foreignObject|use)\b/);
      for (const format of ["markdown", "html"] as const) {
        const snippet = badgeSnippet(variant, format);
        const html =
          format === "markdown"
            ? await marked.parse(snippet, { async: false })
            : snippet;
        expect(html).toContain(`href="${badgeSiteUrl}"`);
        expect(html).toContain(`src="${source}"`);
        expect(html).toContain(`alt="${badgeLabel}"`);
      }
    });
  }
});
