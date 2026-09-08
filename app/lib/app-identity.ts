import { isListingSlug } from "./listings";

export interface AppIdentity {
  appId: string;
  repository: string;
  commit: string;
  path: string;
  screenshot?: string;
}

export function appRepository(value: string) {
  const error = new Error(
    "Provide a repository root URL on github.com, gitlab.com, or gitlab.gnome.org.",
  );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw error;
  }
  const parts = url.pathname
    .replace(/\/$/, "")
    .replace(/\.git$/, "")
    .slice(1)
    .split("/");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    /[\s\\%]/.test(value) ||
    !["github.com", "gitlab.com", "gitlab.gnome.org"].includes(url.hostname) ||
    parts.length < 2 ||
    (url.hostname === "github.com" && parts.length !== 2) ||
    parts.some(
      (part) => !/^[\w.-]+$/.test(part) || [".", "..", "-"].includes(part),
    ) ||
    /\/\.{1,2}(?:\/|$)/.test(value)
  )
    throw error;
  return {
    host: url.hostname,
    project: parts.join("/"),
    url: `${url.origin}/${parts.join("/")}`,
  };
}

/** Keep the upstream ID intact in metadata; derive an internal catalog key. */
export function appIdentitySlug(appId: string) {
  if (
    appId.length > 255 ||
    !/^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*){2,}$/.test(appId)
  )
    throw new Error(
      "Repository metadata must declare a concrete reverse-DNS app ID.",
    );
  const slug = appId
    .toLowerCase()
    .replace(/[._-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!isListingSlug(slug))
    throw new Error("The detected app ID is too long for a catalog key.");
  return slug;
}

export function appIdentitySource(
  identity: Pick<AppIdentity, "repository" | "commit" | "path">,
) {
  const repo = appRepository(identity.repository);
  return `${repo.url}/${repo.host === "github.com" ? "blob" : "-/blob"}/${identity.commit}/${identity.path.split("/").map(encodeURIComponent).join("/")}`;
}
