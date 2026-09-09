import { appRepository } from "../lib/app-identity";
import {
  type RepositoryFetcher,
  repositoryMetadata,
} from "./repository-metadata";

export interface SkillIdentity {
  repository: string;
  commit: string;
  path: string;
  skillName: string;
  description: string;
}

export type ResolveSkillIdentity = (
  repository: string,
  folder: string,
) => Promise<SkillIdentity>;

export function skillFilePath(folder: string) {
  const path = folder.trim().replace(/\/$/, "");
  if (path === ".") return "SKILL.md";
  if (
    path.length > 1024 ||
    !/^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(path) ||
    path.split("/").some((part) => part === "." || part === "..") ||
    path.endsWith("SKILL.md")
  )
    throw new Error(
      "Skill folder path must be relative to the repository root; use . for the root folder.",
    );
  return `${path}/SKILL.md`;
}

/** Read the selected skill at one commit; submitted instructions never execute. */
export async function resolveSkillIdentity(
  repository: string,
  folder: string,
  fetcher: RepositoryFetcher = fetch,
): Promise<SkillIdentity> {
  const repo = appRepository(repository);
  if (repo.host !== "github.com")
    throw new Error(
      "Source repository URL must be a public GitHub repository.",
    );
  const path = skillFilePath(folder);
  const pattern = new RegExp(
    `^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
  );
  const snapshot = await repositoryMetadata(repo.url, pattern, fetcher);
  const file = snapshot.candidates[0];
  if (snapshot.candidates.length !== 1 || !file)
    throw new Error("Skill folder path must contain a regular SKILL.md file.");
  const source = await snapshot.readFile(file);
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
    source,
  )?.[1];
  let metadata: unknown;
  try {
    metadata = frontmatter ? Bun.YAML.parse(frontmatter) : null;
  } catch {
    throw new Error("SKILL.md must contain valid YAML frontmatter.");
  }
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    !("name" in metadata) ||
    typeof metadata.name !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(metadata.name) ||
    !("description" in metadata) ||
    typeof metadata.description !== "string" ||
    !metadata.description.trim()
  )
    throw new Error(
      "SKILL.md frontmatter must declare a skill name and description.",
    );
  return {
    repository: snapshot.repository,
    commit: snapshot.commit,
    path,
    skillName: metadata.name,
    description: metadata.description.trim(),
  };
}
