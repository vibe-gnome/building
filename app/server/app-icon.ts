import type { repositoryMetadata } from "./repository-metadata";

export function repositoryAppIcon(
  snapshot: Awaited<ReturnType<typeof repositoryMetadata>>,
  metadataPath: string,
  appId: string,
) {
  const directory = metadataPath.slice(0, metadataPath.lastIndexOf("/") + 1);
  const names = [
    appId,
    appId.split(".").at(-1),
    snapshot.repository.split("/").at(-1),
    "icon",
    "logo",
    "app",
  ].map((name) => name?.toLowerCase());
  const formats = ["svg", "png", "webp", "jpg", "jpeg"];
  const candidates = snapshot.files.flatMap((file) => {
    const match = /(?:^|\/)([^/]+)\.(svg|png|webp|jpe?g)$/i.exec(file.path);
    if (!match || (file.size !== undefined && file.size > 1024 * 1024))
      return [];
    const nearby = !!directory && file.path.startsWith(directory);
    const relative = nearby ? file.path.slice(directory.length) : file.path;
    // Restrict discovery to branding and GNOME application icon layouts.
    if (
      !/^(?:(?:assets|data|resources|res)\/)?(?:(?:icons?|images)\/)?(?:hicolor\/)?(?:(?:scalable|symbolic|\d+x\d+)\/)?(?:apps\/)?[^/]+$/i.test(
        relative,
      )
    )
      return [];
    const stem = match[1]?.toLowerCase() ?? "";
    const symbolic = stem.endsWith("-symbolic");
    const name = names.indexOf(stem.replace(/-symbolic$/, ""));
    if (name < 0) return [];
    const size = /(?:^|\/)(\d+)x\1\//.exec(relative);
    return [
      {
        file,
        rank: [
          symbolic ? 1 : 0,
          name,
          nearby ? 0 : 1,
          formats.indexOf(match[2]?.toLowerCase() ?? ""),
          -Math.min(Number(size?.[1] ?? 0), 4096),
        ],
      },
    ];
  });
  const compare = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) => {
    for (let i = 0; i < a.rank.length; i++) {
      const difference = (a.rank[i] ?? 0) - (b.rank[i] ?? 0);
      if (difference) return difference;
    }
    return 0;
  };
  candidates.sort(compare);
  const best = candidates[0];
  if (!best || (candidates[1] && compare(best, candidates[1]) === 0))
    return undefined;
  return snapshot.rawFileUrl(best.file);
}
