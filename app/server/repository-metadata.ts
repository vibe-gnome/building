import { appRepository } from "../lib/app-identity";

export type RepositoryFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;
interface TreeEntry {
  path: string;
  type: string;
  mode: string;
  size?: number;
}
const maxFileBytes = 256 * 1024;

/** Read bounded public metadata only; never run a repository's code or build. */
export async function readRepositoryText(
  url: string,
  fetcher: RepositoryFetcher,
  limit: number,
  accept = "application/json",
) {
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: accept,
    },
  });
  if (!response.ok) throw await repositoryResponseError(url, response);
  if (
    accept === "text/html" &&
    !response.headers.get("Content-Type")?.toLowerCase().includes("text/html")
  )
    throw new Error("Repository did not return HTML.");
  return readResponseText(response, limit);
}

async function repositoryResponseError(url: string, response: Response) {
  let detail = "";
  try {
    const body = JSON.parse(await readResponseText(response, 16 * 1024));
    if (typeof body.message === "string")
      detail = body.message.trim().replace(/\s+/g, " ").slice(0, 180);
  } catch {
    // Error pages can be empty, non-JSON, or larger than our diagnostic limit.
  }
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 &&
      response.headers.get("x-ratelimit-remaining") === "0");
  if (rateLimited) detail = "API rate limit exceeded.";
  let retry = "";
  const retryAfter = response.headers.get("retry-after");
  const reset = response.headers.get("x-ratelimit-reset");
  if (retryAfter && /^\d{1,8}$/.test(retryAfter))
    retry = ` Retry after ${Number(retryAfter)} seconds.`;
  else if (rateLimited && reset && /^\d{1,12}$/.test(reset))
    retry = ` Retry after ${new Date(Number(reset) * 1000).toISOString()}.`;
  return new Error(
    `Repository metadata request failed (${response.status}) from ${new URL(url).hostname}${detail ? `: ${detail}` : "."}${retry}`,
  );
}

async function readResponseText(response: Response, limit: number) {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    await readResponseBytes(response, limit),
  );
}

export async function readResponseBytes(response: Response, limit: number) {
  if (!response.body) throw new Error("Repository returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit)
        throw new Error("Repository metadata exceeds the size limit.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function repositoryMetadata(
  repository: string,
  pattern: RegExp,
  fetcher: RepositoryFetcher = fetch,
  pinnedCommit?: string,
) {
  if (pinnedCommit !== undefined && !/^[a-f0-9]{40}$/.test(pinnedCommit))
    throw new Error("Invalid pinned repository commit.");
  const repo = appRepository(repository);
  const github = repo.host === "github.com";
  const api = github
    ? `https://api.github.com/repos/${repo.project}`
    : `https://${repo.host}/api/v4/projects/${encodeURIComponent(repo.project)}`;
  const json = async (url: string) =>
    JSON.parse(await readRepositoryText(url, fetcher, 8 * 1024 * 1024));
  const project = await json(api);
  if (
    project.private === true ||
    (typeof project.visibility === "string" && project.visibility !== "public")
  )
    throw new Error("The submitted repository must be public.");
  if (typeof project.default_branch !== "string" || !project.default_branch)
    throw new Error("The repository has no default branch.");
  const revision = await json(
    `${api}/${github ? "commits" : "repository/commits"}/${encodeURIComponent(pinnedCommit ?? project.default_branch)}`,
  );
  const commit: string = github ? revision.sha : revision.id;
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Repository did not return a valid commit.");
  if (pinnedCommit !== undefined && commit !== pinnedCommit)
    throw new Error("Repository did not return the reviewed commit.");
  const tree: TreeEntry[] = [];
  if (github) {
    const result = await json(`${api}/git/trees/${commit}?recursive=1`);
    if (result.truncated || !Array.isArray(result.tree))
      throw new Error(
        "Repository tree is incomplete; identity cannot be determined.",
      );
    tree.push(...result.tree);
  } else {
    for (let page = 1; ; page++) {
      if (page > 50)
        throw new Error("Repository tree exceeds the discovery limit.");
      const result = await json(
        `${api}/repository/tree?ref=${commit}&recursive=true&per_page=100&page=${page}`,
      );
      if (!Array.isArray(result))
        throw new Error("Repository tree is invalid.");
      tree.push(...result);
      if (result.length < 100) break;
    }
  }
  const files = tree
    .filter(
      (entry) =>
        entry.type === "blob" &&
        ["100644", "100755"].includes(entry.mode) &&
        typeof entry.path === "string" &&
        !entry.path
          .split("/")
          .some((part) => !part || part === "." || part === "..") &&
        !/(?:^|\/)(?:tests?|examples?|fixtures?|vendor|subprojects|node_modules)(?:\/|$)/i.test(
          entry.path,
        ),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const candidates = files.filter((entry) => pattern.test(entry.path));
  if (candidates.length > 20)
    throw new Error(
      "Too many metadata files; repository identity is ambiguous.",
    );
  return {
    repository: repo.url,
    commit,
    defaultBranch: project.default_branch as string,
    candidates,
    files,
    rawFileUrl(entry: TreeEntry) {
      if (!files.includes(entry)) throw new Error("Unknown repository file.");
      const path = entry.path.split("/").map(encodeURIComponent).join("/");
      return github
        ? `https://raw.githubusercontent.com/${repo.project}/${commit}/${path}`
        : `${repo.url}/-/raw/${commit}/${path}`;
    },
    async readFile(entry: TreeEntry) {
      if (entry.size !== undefined && entry.size > maxFileBytes)
        throw new Error("Metadata file exceeds the size limit.");
      if (
        entry.path
          .split("/")
          .some((part) => !part || part === "." || part === "..")
      )
        throw new Error("Invalid metadata path.");
      const fileUrl = github
        ? `${api}/contents/${entry.path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`
        : `${api}/repository/files/${encodeURIComponent(entry.path)}/raw?ref=${commit}`;
      return readRepositoryText(
        fileUrl,
        fetcher,
        maxFileBytes,
        "application/vnd.github.raw+json",
      );
    },
  };
}
