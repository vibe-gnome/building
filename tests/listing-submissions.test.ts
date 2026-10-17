import { describe, expect, test } from "bun:test";
import { parseIssueFields, reviewListing } from "../app/lib/listing-review";
import { listingSubmissionPrompt } from "../app/lib/listing-submissions";
import { showcaseSubmissionUrl } from "../app/lib/showcases";

describe("listing submission options", () => {
  test.each([
    { category: "apps", kind: "app", prefix: "[App]", template: "submit-app" },
    {
      category: "extensions",
      kind: "extension",
      prefix: "[Submit]",
      template: "submit-extension",
    },
  ] as const)(
    "$category agent prompts produce issues accepted by listing review",
    async ({ category, kind, prefix, template }) => {
      const prompt = listingSubmissionPrompt(category);
      const outline = prompt.match(/```markdown\n([\s\S]*?)\n```/)?.[1];
      if (!outline) throw new Error("Missing copy-ready issue body");
      const form = await Bun.file(
        new URL(`../.github/ISSUE_TEMPLATE/${template}.yml`, import.meta.url),
      ).text();
      const labels = [...form.matchAll(/label: (.+)/g)].map((match) =>
        (match[1] ?? "").toLowerCase(),
      );
      const { fields, duplicates } = parseIssueFields(outline);
      expect([...fields.keys()]).toEqual(labels);
      expect(duplicates).toEqual([]);

      const body = outline
        .replaceAll("<project name>", "Desktop Notes")
        .replaceAll(
          "<public repository URL>",
          "https://github.com/example/notes",
        )
        .replaceAll("<comma-separated tags, or leave blank>", "")
        .replaceAll(
          "<what the project does and who it is for>",
          "A local notes tool for GNOME users.",
        );
      const review = reviewListing(`${prefix} Desktop Notes`, body, []);
      expect(review?.kind).toBe(kind);
      expect(review?.passed).toBe(true);
      expect(prompt).toContain(`"${prefix} <project name>"`);

      const url = new URL(showcaseSubmissionUrl(category));
      expect(`${url.origin}${url.pathname}`).toBe(
        "https://github.com/vibe-gnome/building/issues/new",
      );
      expect(url.searchParams.get("template")).toBe(`${template}.yml`);
      expect(prompt).toContain(`${url.origin}/vibe-gnome/building`);
    },
  );
});
