import { type AppIdentity, appRepository } from "./app-identity";
import type { ExtensionIdentity } from "./extension-identity";

export type ListingKind = "app" | "extension" | "extension-update";

export interface ListingCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ListingReview {
  kind: ListingKind;
  passed: boolean;
  checks: ListingCheck[];
  appIdentity?: AppIdentity;
  extensionIdentity?: ExtensionIdentity;
}

export interface CatalogIdentity {
  metadata: { uuid: string };
}

/** Parse GitHub issue-form headings without treating fenced content as fields. */
export function parseIssueFields(body: string) {
  const fields = new Map<string, string>();
  const duplicates: string[] = [];
  let heading = "";
  let lines: string[] = [];
  let fence: { character: string; length: number } | undefined;
  const save = () => {
    if (!heading) return;
    if (fields.has(heading)) duplicates.push(heading);
    fields.set(heading, lines.join("\n").trim());
  };

  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const delimiter = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (delimiter) {
      const marker = delimiter[1] ?? "";
      if (!fence) fence = { character: marker[0] ?? "", length: marker.length };
      else if (
        marker[0] === fence.character &&
        marker.length >= fence.length &&
        !delimiter[2]?.trim()
      )
        fence = undefined;
      lines.push(line);
      continue;
    }
    const match = !fence && /^###\s+(.+?)\s*$/.exec(line);
    if (match) {
      save();
      heading = (match[1] ?? "").toLowerCase();
      lines = [];
    } else {
      lines.push(line);
    }
  }
  save();
  return { fields, duplicates };
}

function hasText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/^_?no response_?$/i.test(value.trim())
  );
}

/** Validate URL syntax without making a network request. */
export function isPublicHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".") &&
      !/^[\d.]+$/.test(url.hostname) &&
      !/\.(localhost|local|internal|test|invalid)$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function validShellVersion(value: unknown) {
  return (
    typeof value === "string" &&
    (/^3\.(?:[0-9]|[12][0-9]|3[0-8])$/.test(value) ||
      (/^[1-9]\d*$/.test(value) && Number(value) >= 40))
  );
}

export function reviewListing(
  title: string,
  body: string,
  catalog: readonly CatalogIdentity[],
  extensionIdentity?: ExtensionIdentity,
): ListingReview | null {
  const { fields, duplicates } = parseIssueFields(body);
  // Reports/removals need direct human triage, even when fields are incomplete.
  if (/^\[Remove\]/i.test(title) || fields.has("reason")) return null;
  let kind: ListingKind;
  if (/^\[App\]/i.test(title) || fields.has("app name")) kind = "app";
  else if (/^\[Update\]/i.test(title) || fields.has("requested changes"))
    kind = "extension-update";
  else if (/^\[Submit\]/i.test(title) || fields.has("extension name"))
    kind = "extension";
  else return null;

  const checks: ListingCheck[] = [];
  const add = (name: string, passed: boolean, detail: string) =>
    checks.push({ name, passed, detail });
  const required = (label: string) => {
    const value = fields.get(label.toLowerCase());
    add(label, hasText(value), hasText(value) ? value : `Fill in ${label}.`);
    return value ?? "";
  };
  const checkUrl = (label: string, value: unknown) => {
    const valid = isPublicHttpsUrl(value);
    add(
      label,
      valid,
      valid
        ? value
        : "Provide a public HTTPS URL without credentials or a custom port.",
    );
  };

  add(
    "Issue form",
    duplicates.length === 0,
    duplicates.length
      ? "Remove repeated field headings."
      : "Field headings are unique.",
  );
  if (kind === "app") {
    required("App name");
    checkUrl(
      "Repository or project URL",
      fields.get("repository or project url"),
    );
    try {
      appRepository(fields.get("repository or project url") ?? "");
    } catch (error) {
      add("App repository", false, (error as Error).message);
    }
    required("Summary");
  } else {
    const name = required("Extension name");
    checkUrl("Source repository", fields.get("source repository"));
    const updating = kind === "extension-update";
    if (updating) required("Your relationship to the extension");
    if (!updating) {
      try {
        appRepository(fields.get("source repository") ?? "");
      } catch (error) {
        add("Extension repository", false, (error as Error).message);
      }
    }
    required(updating ? "Requested changes" : "Summary");
    const uuid = updating ? required("Extension UUID") : undefined;
    if (updating) {
      add(
        "Existing listing",
        catalog.some((entry) => entry.metadata.uuid === uuid),
        "The UUID must match an existing catalog listing.",
      );
    }
    const gnomeUrl = fields.get("gnome extensions listing");
    if (updating && hasText(gnomeUrl)) {
      add(
        "GNOME Extensions listing",
        isPublicHttpsUrl(gnomeUrl) &&
          new URL(gnomeUrl).hostname === "extensions.gnome.org" &&
          /^\/extension\/\d+(?:\/|$)/.test(new URL(gnomeUrl).pathname),
        "Use an extensions.gnome.org/extension/<number>/ listing URL.",
      );
    }
    const raw = updating
      ? fields.get("updated metadata.json")
      : extensionIdentity
        ? JSON.stringify(extensionIdentity.metadata)
        : undefined;
    if (!updating && !extensionIdentity) {
      add(
        "Repository metadata",
        true,
        "UUID and metadata.json will be read from the repository during review.",
      );
    } else if (updating && !hasText(raw)) {
      add(
        "metadata.json",
        true,
        "Not supplied for this listing correction; a maintainer must verify whether metadata changed.",
      );
    } else {
      let metadata: Record<string, unknown> | undefined;
      try {
        const text = (raw ?? "").replace(
          /^(`{3,}|~{3,})(?:json)?\s*\n([\s\S]*?)\n\1\s*$/i,
          "$2",
        );
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          metadata = parsed as Record<string, unknown>;
      } catch {
        // The report gives a stable error, without echoing parser internals.
      }
      add(
        "metadata.json",
        !!metadata,
        metadata
          ? "Valid JSON object."
          : "Paste a JSON object, optionally inside a JSON code fence.",
      );
      if (metadata) {
        const validUuid =
          typeof metadata.uuid === "string" &&
          /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(metadata.uuid);
        add(
          "Metadata UUID",
          validUuid,
          validUuid
            ? String(metadata.uuid)
            : "Use name@namespace with letters, numbers, dots, underscores, or hyphens.",
        );
        add(
          "Metadata name",
          hasText(metadata.name) && metadata.name === name,
          "The metadata name must match Extension name.",
        );
        add(
          "Metadata description",
          hasText(metadata.description),
          hasText(metadata.description)
            ? metadata.description
            : "Provide a non-empty description.",
        );
        const versions = metadata["shell-version"];
        const validVersions =
          Array.isArray(versions) &&
          versions.length > 0 &&
          versions.every(validShellVersion) &&
          new Set(versions).size === versions.length;
        add(
          "Shell versions",
          validVersions,
          validVersions
            ? versions.join(", ")
            : 'Provide unique version strings such as ["3.38", "45", "50"].',
        );
        if (metadata.version !== undefined) {
          add(
            "Metadata version",
            Number.isSafeInteger(metadata.version) &&
              Number(metadata.version) > 0,
            "If supplied, version must be a positive integer.",
          );
        }
        if (metadata.url !== undefined) checkUrl("Metadata URL", metadata.url);
        if (updating) {
          add(
            "Matching UUID",
            metadata.uuid === uuid,
            "Updated metadata must keep the existing listing UUID.",
          );
        } else {
          add(
            "New UUID",
            !catalog.some((entry) => entry.metadata.uuid === metadata.uuid),
            "This extension is already listed. Use Report listing on its detail page to request a correction.",
          );
        }
      }
    }
  }
  return {
    kind,
    passed: checks.every((check) => check.passed),
    checks,
    ...(extensionIdentity ? { extensionIdentity } : {}),
  };
}
