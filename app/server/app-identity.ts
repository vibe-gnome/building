import { type AppIdentity, appIdentitySlug } from "../lib/app-identity";
import { repositoryAppIcon } from "./app-icon";
import {
  type RepositoryFetcher,
  repositoryMetadata,
} from "./repository-metadata";
import { repositoryScreenshot } from "./repository-screenshot";

export type ResolveAppIdentity = (repository: string) => Promise<AppIdentity>;
const metadataFile = /\.(?:metainfo|appdata)\.xml(?:\.in)?$/;
const desktopFile = /\.desktop(?:\.in)?$/;

function concreteId(value: string) {
  const id = value.trim().replace(/\.desktop$/, "");
  try {
    appIdentitySlug(id);
    return id;
  } catch {
    return null;
  }
}

/** Extract only literal IDs. Templates, entities, and build expressions never execute. */
export function metadataAppIds(path: string, source: string): string[] {
  const filename = path.split("/").at(-1) ?? "";
  if (desktopFile.test(path)) {
    const section = source
      .split(/(?=^\[)/m)
      .find(
        (group) =>
          group.startsWith("[Desktop Entry]\n") ||
          group.startsWith("[Desktop Entry]\r\n"),
      );
    if (!section || !/^Type\s*=\s*Application\s*$/m.test(section)) return [];
    const id = concreteId(filename.replace(desktopFile, ""));
    return id ? [id] : [];
  }
  if (!metadataFile.test(path)) return [];
  const xml = source.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("App metadata must not contain XML entity declarations.");
  const ids: string[] = [];
  for (const component of xml.matchAll(
    /<component\b([^>]*)>([\s\S]*?)<\/component\s*>/g,
  )) {
    if (!/\btype\s*=\s*(["'])desktop-application\1/.test(component[1] ?? ""))
      continue;
    const values = [
      ...(component[2] ?? "").matchAll(/<id\s*>([^<]+)<\/id\s*>/g),
    ];
    if (values.length > 1)
      throw new Error("AppStream component has multiple ID fields.");
    const value = values[0]?.[1];
    if (value) {
      const id = concreteId(value);
      if (id) ids.push(id);
      else if (
        path.endsWith(".in") &&
        /^@[A-Za-z_][\w]*@$/.test(value.trim())
      ) {
        const filenameId = concreteId(filename.replace(metadataFile, ""));
        if (filenameId) ids.push(filenameId);
      }
    }
  }
  return [...new Set(ids)];
}

export async function resolveAppIdentity(
  repository: string,
  fetcher: RepositoryFetcher = fetch,
): Promise<AppIdentity> {
  const snapshot = await repositoryMetadata(
    repository,
    /\.(?:(?:metainfo|appdata)\.xml|desktop)(?:\.in)?$/,
    fetcher,
  );
  const { candidates, commit } = snapshot;
  for (const pattern of [metadataFile, desktopFile]) {
    const identities = new Map<string, string>();
    for (const entry of candidates.filter((item) => pattern.test(item.path))) {
      for (const id of metadataAppIds(
        entry.path,
        await snapshot.readFile(entry),
      ))
        if (!identities.has(id)) identities.set(id, entry.path);
    }
    if (identities.size > 1)
      throw new Error(
        "Multiple app IDs found in the repository; a maintainer must resolve the ambiguity upstream.",
      );
    const identity = identities.entries().next().value;
    if (identity) {
      const icon = repositoryAppIcon(snapshot, identity[1], identity[0]);
      const screenshot = await repositoryScreenshot(
        snapshot.repository,
        fetcher,
        snapshot,
      );
      return {
        appId: identity[0],
        repository: snapshot.repository,
        commit,
        path: identity[1],
        ...(icon ? { icon } : {}),
        ...(screenshot ? { screenshot } : {}),
      };
    }
  }
  throw new Error(
    "No app ID found. The repository needs AppStream metadata or a reverse-DNS .desktop file.",
  );
}
