import { appRepository } from "../app/lib/app-identity";
import { repositoryAppIcon } from "../app/server/app-icon";
import {
  type RepositoryFetcher,
  repositoryMetadata,
} from "../app/server/repository-metadata";
import { createRepositoryFetcher } from "./repository-fetch";

interface AppIconRow {
  slug: string;
  payload: string;
  revision: string;
  evidence: string;
}

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Generate maintenance SQL without changing D1 or rewriting approval evidence. */
export async function appIconBackfillSql(
  rows: readonly AppIconRow[],
  fetcher: RepositoryFetcher = fetch,
  now = new Date().toISOString(),
) {
  const statements: string[] = [];
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    if (payload.icon && payload.icon !== "/icons/showcase/apps.svg") continue;
    const evidence = JSON.parse(row.evidence);
    const identity = evidence.appIdentity;
    if (!identity) continue;
    if (
      payload.id !== row.slug ||
      identity.appId !== payload.appId ||
      typeof identity.appId !== "string" ||
      typeof identity.path !== "string" ||
      typeof identity.commit !== "string" ||
      !/^[a-f0-9]{40}$/.test(identity.commit) ||
      appRepository(identity.repository).url !== appRepository(payload.href).url
    )
      throw new Error(`Stored app identity does not match ${row.slug}.`);
    const snapshot = await repositoryMetadata(
      identity.repository,
      /\.(?:(?:metainfo|appdata)\.xml|desktop)(?:\.in)?$/,
      fetcher,
      identity.commit,
    );
    if (!snapshot.candidates.some((file) => file.path === identity.path))
      throw new Error(`Reviewed metadata is missing for ${row.slug}.`);
    const icon = repositoryAppIcon(snapshot, identity.path, identity.appId);
    if (!icon) continue;
    const maintenance = JSON.stringify({
      previousRevision: row.revision,
      repository: snapshot.repository,
      commit: snapshot.commit,
      metadataPath: identity.path,
      icon,
      reason:
        "Restore the missing app icon from the previously reviewed commit.",
    });
    // Exact snapshots make reruns and concurrent publication harmless.
    statements.push(`UPDATE listings
SET payload = json_set(payload, '$.icon', ${sqlString(icon)}),
    evidence = json_set(evidence, '$.iconBackfill', json(${sqlString(maintenance)})),
    revision = ${sqlString(`${row.revision}-icon-backfill-v1`)},
    reviewed_by = 'repository-icon-backfill',
    updated_at = ${sqlString(now)}
WHERE category = 'apps' AND status = 'published'
  AND slug = ${sqlString(row.slug)}
  AND revision = ${sqlString(row.revision)}
  AND payload = ${sqlString(row.payload)}
  AND evidence = ${sqlString(row.evidence)};`);
  }
  return statements.join("\n\n");
}

if (import.meta.main) {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3)
    throw new Error(
      "Usage: bun scripts/backfill-app-icons.ts <wrangler-query.json>",
    );
  const results = await Bun.file(input).json();
  if (
    !Array.isArray(results) ||
    results.some((result) => !result.success || !Array.isArray(result.results))
  )
    throw new Error("Expected successful Wrangler D1 JSON query results.");
  const sql = await appIconBackfillSql(
    results.flatMap((result) => result.results),
    process.env.GITHUB_TOKEN
      ? createRepositoryFetcher(process.env.GITHUB_TOKEN)
      : fetch,
  );
  console.log(sql || "-- No missing repository icons to backfill.");
}
