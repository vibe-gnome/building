import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appRepository } from "../app/lib/app-identity";
import {
  resolveSkillIdentity,
  type SkillIdentity,
  skillFilePath,
} from "../app/server/skill-identity";
import { issueField, submissionTarget } from "./check-skill-audits";

export const skillsCliVersion = "1.5.25";
export type SkillInstallTarget = Omit<SkillIdentity, "description">;
export type InstallSkill = (target: SkillInstallTarget) => Promise<void>;

export class SkillInstallError extends Error {}

export function skillInstallTarget(
  body: string,
  identity?: SkillIdentity,
): SkillInstallTarget {
  const url = submissionTarget(body, identity);
  if (identity) return identity;
  const source = new URL(issueField(body, "SKILL.md permalink"));
  const [owner, repository, , commit, ...path] = source.pathname
    .slice(1)
    .split("/");
  return {
    repository: `https://github.com/${owner}/${repository}`,
    commit: commit ?? "",
    path: path.join("/"),
    skillName: url.pathname.split("/").at(-1) ?? "",
  };
}

export function skillInstallCommand(target: SkillInstallTarget): string[] {
  const repository = appRepository(target.repository);
  const folder =
    target.path === "SKILL.md"
      ? "."
      : target.path.slice(0, -"/SKILL.md".length);
  if (
    repository.host !== "github.com" ||
    !/^[a-f0-9]{40}$/i.test(target.commit) ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(target.skillName) ||
    skillFilePath(folder) !== target.path
  )
    throw new SkillInstallError("Skill installation target is invalid.");
  return [
    "npx",
    "--yes",
    "--ignore-scripts",
    `skills@${skillsCliVersion}`,
    "add",
    `${repository.url}/tree/${target.commit}${folder === "." ? "" : `/${folder}`}`,
    "--skill",
    target.skillName,
    "--agent",
    "codex",
    "--copy",
    "--yes",
  ];
}

export type InstallRunner = (
  command: readonly string[],
  options: { cwd: string; env: Record<string, string>; timeoutMs: number },
) => Promise<void>;

export const runSkillInstaller: InstallRunner = (command, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command[0] ?? "npx", command.slice(1), {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      detached: true,
      // Submitted content must not become GitHub Actions log commands.
      stdio: "ignore",
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    }, options.timeoutMs);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new SkillInstallError("Skill installation could not start npx."));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut)
        reject(
          new SkillInstallError(
            "Skill installation timed out. Retry the workflow.",
          ),
        );
      else if (code !== 0)
        reject(
          new SkillInstallError(
            `Skill installation failed (exit ${code ?? "unknown"}). Check that the selected skill can be installed with npx skills add, then retry.`,
          ),
        );
      else resolve();
    });
  });

export async function installReviewSkill(
  target: SkillInstallTarget,
  run: InstallRunner = runSkillInstaller,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const command = skillInstallCommand(target);
  const directory = await mkdtemp(join(tmpdir(), "vibe-gnome-skill-install-"));
  try {
    const cwd = join(directory, "project");
    const installHome = join(directory, "home");
    const temporary = join(directory, "tmp");
    await Promise.all([cwd, installHome, temporary].map((path) => mkdir(path)));
    // Supply a fresh child environment, not the parent workflow's credentials,
    // npm configuration, Git configuration, or agent installation directories.
    const env: Record<string, string> = {
      PATH: environment.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: installHome,
      TMPDIR: temporary,
      XDG_CONFIG_HOME: join(installHome, ".config"),
      CI: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_LFS_SKIP_SMUDGE: "1",
      npm_config_cache: join(directory, "npm-cache"),
      npm_config_userconfig: join(directory, "npmrc"),
      npm_config_globalconfig: join(directory, "global-npmrc"),
      npm_config_registry: "https://registry.npmjs.org",
      npm_config_ignore_scripts: "true",
      npm_config_fetch_retries: "1",
      npm_config_fetch_timeout: "20000",
    };
    for (const key of [
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "NO_PROXY",
      "https_proxy",
      "http_proxy",
      "all_proxy",
      "no_proxy",
      "DISABLE_TELEMETRY",
      "DO_NOT_TRACK",
    ]) {
      const value = environment[key];
      if (value !== undefined) env[key] = value;
    }
    await run(command, { cwd, env, timeoutMs: 120_000 });
    try {
      const skillsDirectory = join(cwd, ".agents/skills");
      const folders = await readdir(skillsDirectory, { withFileTypes: true });
      const folder = folders[0];
      if (folders.length !== 1 || !folder?.isDirectory()) throw new Error();
      const source = await readFile(
        join(skillsDirectory, folder.name, "SKILL.md"),
        "utf8",
      );
      const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
        source,
      )?.[1];
      const metadata = frontmatter ? Bun.YAML.parse(frontmatter) : null;
      const lock = JSON.parse(
        await readFile(join(cwd, "skills-lock.json"), "utf8"),
      );
      const entries = Object.values(lock.skills ?? {}) as Record<
        string,
        unknown
      >[];
      const entry = entries[0];
      if (
        !metadata ||
        typeof metadata !== "object" ||
        !("name" in metadata) ||
        metadata.name !== target.skillName ||
        lock.version !== 1 ||
        entries.length !== 1 ||
        entry?.source !== new URL(target.repository).pathname.slice(1) ||
        entry?.sourceType !== "github" ||
        entry?.ref !== target.commit ||
        entry?.skillPath !== target.path
      )
        throw new Error();
    } catch {
      throw new SkillInstallError(
        "Skill installation did not produce the selected skill at the reviewed commit and path.",
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const identity = await resolveSkillIdentity(
      process.argv[2] ?? "",
      process.argv[3] ?? "",
    );
    await installReviewSkill(identity);
    console.log(
      `Installed ${identity.skillName} at ${identity.commit} in a temporary directory; files removed. skills.sh indexing and audits may still be pending.`,
    );
  } catch (error) {
    console.error(
      error instanceof SkillInstallError
        ? error.message
        : "Could not resolve or install the submitted skill.",
    );
    process.exitCode = 1;
  }
}
