import type { ExtensionIdentity } from "../lib/extension-identity";
import {
  type RepositoryFetcher,
  repositoryMetadata,
} from "./repository-metadata";

export type ResolveExtensionIdentity = (
  repository: string,
) => Promise<ExtensionIdentity>;

function repositoryIcon(
  snapshot: Awaited<ReturnType<typeof repositoryMetadata>>,
  metadataPath: string,
  uuid: string,
) {
  const directory = metadataPath.slice(0, metadataPath.lastIndexOf("/") + 1);
  const names = [
    "icon",
    "logo",
    uuid.toLowerCase(),
    uuid.split("@")[0]?.toLowerCase(),
    snapshot.repository.split("/").at(-1)?.toLowerCase(),
    "extension",
  ];
  const formats = ["svg", "png", "webp", "jpg", "jpeg"];
  const images = snapshot.files.flatMap((file) => {
    const match = /^(.*)\.(svg|png|webp|jpe?g)$/i.exec(file.path);
    if (!match || (file.size !== undefined && file.size > 1024 * 1024))
      return [];
    const relative =
      directory && file.path.startsWith(directory)
        ? file.path.slice(directory.length)
        : file.path;
    // Only consider branding assets, not screenshots or arbitrary UI images.
    if (
      !/^(?:(?:assets|data|resources)\/)?(?:(?:icons?|images)\/)?[^/]+$/i.test(
        relative,
      )
    )
      return [];
    const stem = match[1]?.split("/").at(-1)?.toLowerCase() ?? "";
    const symbolic = stem.endsWith("-symbolic");
    const name = names.indexOf(stem.replace(/-symbolic$/, ""));
    const iconDirectory = /(?:^|\/)icons?\//i.test(relative);
    if (name < 0 && !iconDirectory) return [];
    return [
      {
        file,
        named: name >= 0,
        score:
          (symbolic ? 100 : 0) +
          (name < 0 ? 50 : name * 5) +
          formats.indexOf(match[2]?.toLowerCase() ?? "") +
          (directory && !file.path.startsWith(directory) ? 200 : 0),
      },
    ];
  });
  const named = images.filter((image) => image.named);
  const candidates = named.length ? named : images.length === 1 ? images : [];
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  if (!best || best.score === candidates[1]?.score) return undefined;
  return snapshot.rawFileUrl(best.file);
}

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
  const icon = repositoryIcon(snapshot, file.path, metadata.uuid);
  return {
    metadata,
    repository: snapshot.repository,
    commit: snapshot.commit,
    path: file.path,
    ...(icon ? { icon } : {}),
  };
}
