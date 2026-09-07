import type { ExtensionIdentity } from "../lib/extension-identity";
import {
  type RepositoryFetcher,
  repositoryMetadata,
} from "./repository-metadata";

export type ResolveExtensionIdentity = (
  repository: string,
) => Promise<ExtensionIdentity>;

export async function resolveExtensionIdentity(
  repository: string,
  fetcher: RepositoryFetcher = fetch,
): Promise<ExtensionIdentity> {
  const snapshot = await repositoryMetadata(
    repository,
    /(?:^|\/)metadata\.json$/,
    fetcher,
  );
  if (snapshot.candidates.length !== 1)
    throw new Error(
      snapshot.candidates.length
        ? "Multiple metadata.json files found. A maintainer must resolve the extension identity upstream."
        : "No metadata.json found in the extension repository.",
    );
  const file = snapshot.candidates[0];
  if (!file) throw new Error("Extension metadata is missing.");
  let metadata: ExtensionIdentity["metadata"];
  try {
    metadata = JSON.parse(await snapshot.readFile(file));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("Repository metadata.json must contain valid JSON.");
  }
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    typeof metadata.uuid !== "string" ||
    !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(metadata.uuid)
  )
    throw new Error(
      "Repository metadata.json must contain a literal extension UUID (name@namespace).",
    );
  return {
    metadata,
    repository: snapshot.repository,
    commit: snapshot.commit,
    path: file.path,
  };
}
