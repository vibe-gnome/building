import { describe, expect, test } from "bun:test";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  parseAudits,
  SkillAuditHttpError,
} from "../scripts/check-skill-audits";
import {
  type InstallRunner,
  installReviewSkill,
  runSkillInstaller,
  SkillInstallError,
  type SkillInstallTarget,
  skillInstallCommand,
  skillInstallTarget,
} from "../scripts/install-review-skill";
import { checkInstalledSkillAudits } from "../scripts/review-skill-submission";

const target: SkillInstallTarget = {
  repository: "https://github.com/stonega/harness",
  commit: "a".repeat(40),
  path: "skills/gnome-svg-icons/SKILL.md",
  skillName: "gnome-svg-icons",
};

async function installedFiles(
  cwd: string,
  changes: Record<string, unknown> = {},
) {
  const folder = join(cwd, ".agents/skills/gnome-svg-icons");
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, "SKILL.md"),
    "---\nname: gnome-svg-icons\ndescription: GNOME icons\n---\n",
  );
  await writeFile(
    join(cwd, "skills-lock.json"),
    JSON.stringify({
      version: 1,
      skills: {
        "gnome-svg-icons": {
          source: "stonega/harness",
          sourceType: "github",
          ref: target.commit,
          skillPath: target.path,
          ...changes,
        },
      },
    }),
  );
}

describe("temporary skill installation", () => {
  test("pins the CLI, commit, folder, and one project-scoped agent/skill", () => {
    expect(skillInstallCommand(target)).toEqual([
      "npx",
      "--yes",
      "--ignore-scripts",
      "skills@1.5.25",
      "add",
      `${target.repository}/tree/${target.commit}/skills/gnome-svg-icons`,
      "--skill",
      "gnome-svg-icons",
      "--agent",
      "codex",
      "--copy",
      "--yes",
    ]);
    expect(skillInstallCommand({ ...target, path: "SKILL.md" })[5]).toBe(
      `${target.repository}/tree/${target.commit}`,
    );
  });

  test.each([
    { commit: "main" },
    { skillName: "--all" },
    { skillName: "name; echo bad" },
    { path: "../SKILL.md" },
    { path: "skills/wrong.md" },
    { repository: "https://github.com/stonega/harness/tree/main" },
    { repository: "https://gitlab.com/stonega/harness" },
  ])("rejects invalid install target %j", (changes) => {
    expect(() => skillInstallCommand({ ...target, ...changes })).toThrow();
  });

  test("supports the immutable source in legacy submissions", () => {
    const body = `### Skill name\n\nGNOME SVG Icons\n\n### skills.sh URL\n\nhttps://skills.sh/stonega/harness/gnome-svg-icons\n\n### Source repository URL\n\n${target.repository}\n\n### SKILL.md permalink\n\n${target.repository}/blob/${target.commit}/${target.path}`;
    expect(skillInstallTarget(body)).toEqual(target);
    expect(() =>
      skillInstallTarget(body.replace("/blob/", "/tree/")),
    ).toThrow();
  });

  test("installs outside the checkout without inherited credentials and always cleans up", async () => {
    let temporary = "";
    const run: InstallRunner = async (command, { cwd, env, timeoutMs }) => {
      temporary = dirname(cwd);
      expect(cwd).not.toBe(process.cwd());
      expect(command).toEqual(skillInstallCommand(target));
      expect(timeoutMs).toBe(120_000);
      expect(env.HOME).toBe(join(temporary, "home"));
      expect(env.npm_config_cache).toBe(join(temporary, "npm-cache"));
      expect(env.npm_config_ignore_scripts).toBe("true");
      expect(env.CI).toBe("1");
      expect(env.HTTPS_PROXY).toBe("http://localhost:7890");
      for (const key of [
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "CLOUDFLARE_API_TOKEN",
        "NODE_OPTIONS",
        "SSH_AUTH_SOCK",
        "GITHUB_ENV",
        "GITHUB_OUTPUT",
        "CODEX_HOME",
      ])
        expect(env[key]).toBeUndefined();
      expect(env.DISABLE_TELEMETRY).toBeUndefined();
      await installedFiles(cwd);
    };
    await installReviewSkill(target, run, {
      PATH: "/usr/bin",
      HOME: "/real-home",
      CODEX_HOME: "/real-codex",
      GITHUB_TOKEN: "secret",
      GH_TOKEN: "secret",
      CLOUDFLARE_API_TOKEN: "secret",
      NODE_OPTIONS: "--require=bad",
      SSH_AUTH_SOCK: "/agent.sock",
      GITHUB_ENV: "/workflow/env",
      GITHUB_OUTPUT: "/workflow/output",
      HTTPS_PROXY: "http://localhost:7890",
    });
    expect(temporary).not.toBe("");
    await expect(access(temporary)).rejects.toThrow();
  });

  test("respects explicit telemetry opt-out", async () => {
    await installReviewSkill(
      target,
      async (_, { cwd, env }) => {
        expect(env.DO_NOT_TRACK).toBe("1");
        await installedFiles(cwd);
      },
      { DO_NOT_TRACK: "1" },
    );
  });

  test.each([
    "failure",
    "no files",
    "wrong commit",
    "wrong folder",
    "wrong repository",
  ])("rejects %s and removes the temporary install", async (scenario) => {
    let temporary = "";
    await expect(
      installReviewSkill(target, async (_, { cwd }) => {
        temporary = dirname(cwd);
        if (scenario === "failure")
          throw new SkillInstallError("Skill installation failed.");
        if (scenario === "no files") return;
        await installedFiles(cwd, {
          ...(scenario === "wrong commit" ? { ref: "b".repeat(40) } : {}),
          ...(scenario === "wrong folder"
            ? { skillPath: "other/SKILL.md" }
            : {}),
          ...(scenario === "wrong repository" ? { source: "other/repo" } : {}),
        });
      }),
    ).rejects.toBeInstanceOf(SkillInstallError);
    await expect(access(temporary)).rejects.toThrow();
  });

  test("the process runner handles failures and timeout without echoing child output", async () => {
    const options = { cwd: process.cwd(), env: {}, timeoutMs: 2_000 };
    await runSkillInstaller(
      [process.execPath, "-e", "process.exit(0)"],
      options,
    );
    await expect(
      runSkillInstaller(
        [process.execPath, "-e", "console.log('untrusted'); process.exit(2)"],
        options,
      ),
    ).rejects.toThrow("exit 2");
    await expect(
      runSkillInstaller(
        [process.execPath, "-e", "setInterval(() => {}, 1000)"],
        { ...options, timeoutMs: 50 },
      ),
    ).rejects.toThrow("timed out");
    await expect(runSkillInstaller(["/missing/npx"], options)).rejects.toThrow(
      "could not start",
    );
  });
});

describe("audit availability after installation", () => {
  const url = "https://www.skills.sh/vercel-labs/skills/find-skills";
  const fixture = Bun.file("tests/fixtures/skill-audits.html");

  test("retries missing pages and pending audits before accepting PASS", async () => {
    const html = await fixture.text();
    let calls = 0;
    const waits: number[] = [];
    const result = await checkInstalledSkillAudits(
      url,
      async () => {
        calls++;
        if (calls === 1) throw new SkillAuditHttpError(404);
        return parseAudits(
          calls === 2
            ? html.replace(
                "Socket</span><span>Pass",
                "Socket</span><span>Pending",
              )
            : html,
          url,
        );
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(result.passed).toBe(true);
    expect(calls).toBe(3);
    expect(waits).toEqual([15_000, 15_000]);
  });

  test.each(["missing", "unknown", "pending", "fail", "warn", "offline"])(
    "bounds retries and blocks %s",
    async (scenario) => {
      const html = await fixture.text();
      let calls = 0;
      const result = checkInstalledSkillAudits(
        url,
        async () => {
          calls++;
          if (scenario === "missing") throw new SkillAuditHttpError(404);
          if (scenario === "offline") throw new Error("offline");
          return parseAudits(
            html.replace(
              "Socket</span><span>Pass",
              `Socket</span><span>${scenario}`,
            ),
            url,
          );
        },
        async () => {},
      );
      if (scenario === "missing" || scenario === "offline")
        await expect(result).rejects.toThrow();
      else expect((await result).passed).toBe(false);
      expect(calls).toBe(
        ["missing", "unknown", "pending"].includes(scenario) ? 3 : 1,
      );
    },
  );
});
