import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseIssueFields } from "../app/lib/listing-review";
import type { ResolveExtensionIdentity } from "../app/server/extension-identity";
import {
  type GitHubRequest,
  runListingReview,
} from "../scripts/listing-review";
import { publishListing } from "../scripts/publish-listing";
import { catalogDatabase } from "./helpers/catalog-db";

test.each([
  { icon: undefined },
  {
    icon: `https://raw.githubusercontent.com/example/extension/${"a".repeat(40)}/icon.svg`,
    screenshot:
      "https://repository-images.githubusercontent.com/12345/extension-preview.png",
  },
])(
  "current extension form passes review and publication: %j",
  async ({ icon, screenshot }) => {
    const identity = {
      repository: "https://github.com/example/extension",
      commit: "a".repeat(40),
      path: "metadata.json",
      ...(icon ? { icon } : {}),
      ...(screenshot ? { screenshot } : {}),
      metadata: {
        uuid: "example@example.org",
        name: "Example Extension",
        description: "A focused desktop extension.",
        "shell-version": ["50"],
      },
    };
    const values: Record<string, string> = {
      "Extension name": identity.metadata.name,
      "Source repository": identity.repository,
      Summary: identity.metadata.description,
      "Category and tags": "Workflow, workspaces",
    };
    const form = Bun.YAML.parse(
      readFileSync(".github/ISSUE_TEMPLATE/submit-extension.yml", "utf8"),
    ) as {
      title: string;
      body: {
        attributes: { label?: string };
        validations?: { required?: boolean };
      }[];
    };
    const issue = {
      number: 42,
      title: `${form.title}${identity.metadata.name}`,
      body: form.body
        .filter((field) => field.attributes.label)
        .map((field) => {
          const label = field.attributes.label ?? "";
          if (field.validations?.required) expect(values[label]).toBeDefined();
          return `### ${label}\n\n${values[label] ?? "_No response_"}`;
        })
        .join("\n\n"),
      state: "open",
      labels: [{ name: "unrelated" }],
    };
    const comments: {
      id: number;
      body: string;
      user: { login: string; type: string };
    }[] = [];
    const github: GitHubRequest = async <T>(
      path: string,
      method = "GET",
      payload?: unknown,
    ): Promise<T> => {
      if (path === "/issues/42" && method === "GET")
        return structuredClone(issue) as T;
      if (path === "/issues/42/comments?per_page=100&page=1")
        return structuredClone(comments) as T;
      if (path === "/issues/42/comments" && method === "POST") {
        const comment = {
          id: 100,
          body: (payload as { body: string }).body,
          user: { login: "github-actions[bot]", type: "Bot" },
        };
        comments.push(comment);
        return comment as T;
      }
      if (path.startsWith("/labels/") && method === "GET")
        return { name: decodeURIComponent(path.slice(8)) } as T;
      if (path === "/issues/42/labels" && method === "POST") {
        issue.labels.push(
          ...(payload as { labels: string[] }).labels.map((name) => ({ name })),
        );
        return issue.labels as T;
      }
      if (path === "/collaborators/maintainer/permission" && method === "GET")
        return { permission: "write" } as T;
      throw new Error(`Unexpected request: ${method} ${path}`);
    };
    let resolutions = 0;
    const resolveExtension: ResolveExtensionIdentity = async (repository) => {
      expect(repository).toBe(identity.repository);
      resolutions++;
      return identity;
    };
    const data = catalogDatabase();
    try {
      const report = await runListingReview(
        { action: "opened", issue },
        github,
        await data.catalog.list("extensions"),
        undefined,
        resolveExtension,
      );
      expect(issue.labels).toContainEqual({ name: "review:needs-human" });
      expect(comments).toHaveLength(1);
      expect(report).toContain(icon ?? "Extensions puzzle icon");
      if (screenshot) expect(report).toContain(screenshot);
      expect(await data.catalog.get("extensions", "submission-42")).toBeNull();
      const command = report.match(/\/publish-listing [a-f0-9]{64}/)?.[0];
      if (!command)
        throw new Error("Review did not provide an approval command");
      const event = {
        action: "created",
        issue,
        comment: {
          id: 999,
          body: command,
          user: { login: "maintainer", type: "User" },
        },
      };
      const result = await publishListing(
        event,
        github,
        data.query,
        undefined,
        undefined,
        resolveExtension,
      );
      expect(resolutions).toBe(2);
      const saved = await data.catalog.get("extensions", "submission-42");
      expect(saved?.metadata).toEqual(identity.metadata);
      expect(saved?.category).toBe("Workflow");
      expect(saved?.tags).toEqual(["workspaces"]);
      expect(saved?.icon).toBe(icon ?? "/icons/showcase/extensions.svg");
      expect(saved?.screenshot).toBe(screenshot);
      expect(saved?.gnomeUrl).toBeUndefined();
      expect(result).toContain(`/extensions/${saved?.dbId}/example`);
      const row = (
        await data.query(
          "SELECT evidence FROM listing_reviews WHERE source_issue = 42",
        )
      ).results[0];
      const evidence = JSON.parse(String(row?.evidence));
      expect(evidence.extensionIdentity).toEqual(identity);
      expect(evidence.body).toBe(issue.body);
      expect(parseIssueFields(evidence.body).fields.has("screenshots")).toBe(
        false,
      );

      issue.body += "\n\nUpdated extension requirements.";
      await expect(
        publishListing(
          event,
          github,
          data.query,
          undefined,
          undefined,
          resolveExtension,
        ),
      ).rejects.toThrow("Rerun checks");
      expect(
        (
          await data.query(
            "SELECT evidence FROM listing_reviews WHERE source_issue = 42",
          )
        ).results,
      ).toHaveLength(1);
    } finally {
      data.db.close();
    }
  },
);
