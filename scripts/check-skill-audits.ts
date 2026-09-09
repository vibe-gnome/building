import { appRepository } from "../app/lib/app-identity";
import {
  type ResolveSkillIdentity,
  resolveSkillIdentity,
  type SkillIdentity,
  skillFilePath,
} from "../app/server/skill-identity";

export const auditProviders = [
  { slug: "agent-trust-hub", name: "Gen Agent Trust Hub", required: true },
  { slug: "socket", name: "Socket", required: true },
  { slug: "snyk", name: "Snyk", required: false },
] as const;

type AuditStatus = "PASS" | "WARN" | "FAIL" | "PENDING" | "UNKNOWN";

export interface AuditReport {
  url: string;
  checkedAt: string;
  passed: boolean;
  audits: {
    name: string;
    url: string;
    required: boolean;
    status: AuditStatus;
  }[];
}

// Restrict every request (including redirects) to a single skills.sh skill page.
export function skillUrl(input: string): URL {
  const value = input.trim();
  if (
    value.length > 2048 ||
    !/^https:\/\/(?:www\.)?skills\.sh\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/?$/i.test(
      value,
    )
  ) {
    throw new Error("Use an HTTPS skills.sh/owner/repository/skill-name URL.");
  }
  const url = new URL(value);
  url.hostname = "www.skills.sh";
  url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

export function issueField(body: string, label: string): string {
  const sections = body.replace(/\r\n/g, "\n").split(/^### /m);
  const matches = sections
    .slice(1)
    .filter((part) => part.split("\n")[0] === label);
  const value = matches[0]?.slice(label.length).trim();
  if (matches.length !== 1 || !value || value === "_No response_") {
    throw new Error(
      `Provide exactly one ${label} field in the submission form.`,
    );
  }
  return value;
}

export function submissionTarget(body: string, identity?: SkillIdentity): URL {
  if (/^### Skill folder path\r?$/m.test(body)) {
    issueField(body, "Skill name");
    const path = skillFilePath(issueField(body, "Skill folder path"));
    if (!identity || identity.path !== path)
      throw new Error("Skill folder path must be resolved before publication.");
    const source = appRepository(issueField(body, "Source repository URL"));
    if (
      source.host !== "github.com" ||
      source.url.toLowerCase() !== identity.repository.toLowerCase()
    )
      throw new Error(
        "Source repository URL must match the resolved skill repository.",
      );
    return skillUrl(
      `https://skills.sh/${new URL(identity.repository).pathname.slice(1)}/${identity.skillName}`,
    );
  }
  // Existing issues retain their explicit skills.sh URL and immutable source.
  const url = skillUrl(issueField(body, "skills.sh URL"));
  const [owner, repository] = url.pathname.slice(1).split("/");
  const source = `https://github.com/${owner}/${repository}`;
  const submittedSource = issueField(body, "Source repository URL").replace(
    /\/$/,
    "",
  );
  if (submittedSource.toLowerCase() !== source.toLowerCase()) {
    throw new Error(
      "Source repository URL must match the repository on skills.sh.",
    );
  }
  const permalink = issueField(body, "SKILL.md permalink");
  const prefix = `${source}/blob/`;
  if (
    !permalink.toLowerCase().startsWith(prefix.toLowerCase()) ||
    !/^[a-f0-9]{40}\/(?:[a-z0-9_.-]+\/)*SKILL\.md$/.test(
      permalink.slice(prefix.length),
    ) ||
    permalink.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error(
      "SKILL.md permalink must use a full commit SHA in the same repository.",
    );
  }
  return url;
}

export async function resolveSkillTarget(
  body: string,
  resolve: ResolveSkillIdentity = resolveSkillIdentity,
): Promise<{ url: URL; identity?: SkillIdentity }> {
  if (!/^### Skill folder path\r?$/m.test(body))
    return { url: submissionTarget(body) };
  issueField(body, "Skill name");
  const identity = await resolve(
    issueField(body, "Source repository URL"),
    issueField(body, "Skill folder path"),
  );
  return { url: submissionTarget(body, identity), identity };
}

export function parseAudits(html: string, input: string): AuditReport {
  const url = skillUrl(input);
  // Only inspect the rendered metadata sidebar, never author-controlled SKILL.md
  // content or serialized scripts. Layout changes deliberately block the check.
  const sidebar = 'main > div > div[class~="lg:col-span-3"]';
  let headings = 0;
  let heading = "";
  const rows = new Map<string, string[]>();
  let current: { href: string; text: string } | undefined;
  new HTMLRewriter()
    .on(`${sidebar} > div > div`, {
      element(element) {
        heading = "";
        element.onEndTag(() => {
          if (heading.trim() === "Security Audits") headings++;
        });
      },
      text(chunk) {
        heading += chunk.text;
      },
    })
    .on(`${sidebar} > div > div > a`, {
      element(element) {
        const row = { href: element.getAttribute("href") ?? "", text: "" };
        current = row;
        element.onEndTag(() => {
          const values = rows.get(row.href) ?? [];
          values.push(row.text);
          rows.set(row.href, values);
          current = undefined;
        });
      },
      text(chunk) {
        if (current) current.text += chunk.text;
      },
    })
    .transform(html);

  const audits = auditProviders.map((provider) => {
    const path = `${url.pathname}/security/${provider.slug}`;
    const values = [
      ...(rows.get(path) ?? []),
      ...(rows.get(`https://skills.sh${path}`) ?? []),
      ...(rows.get(`https://www.skills.sh${path}`) ?? []),
    ];
    const text = values[0]?.replace(/\s/g, "").toUpperCase();
    const statuses: AuditStatus[] = ["PASS", "WARN", "FAIL", "PENDING"];
    const status =
      headings === 1 && values.length === 1
        ? (statuses.find(
            (value) =>
              text === provider.name.replace(/\s/g, "").toUpperCase() + value,
          ) ?? "UNKNOWN")
        : "UNKNOWN";
    return {
      name: provider.name,
      required: provider.required,
      status,
      url: `${url.origin}${path}`,
    };
  });
  return {
    url: url.href,
    checkedAt: new Date().toISOString(),
    passed: audits
      .filter((audit) => audit.required)
      .every((audit) => audit.status === "PASS"),
    audits,
  };
}

export type AuditRequest = (
  url: string,
  options: RequestInit,
) => Promise<Response>;

export async function checkSkillAudits(
  input: string,
  request: AuditRequest = fetch,
): Promise<AuditReport> {
  const target = skillUrl(input);
  let url = target.href;
  const signal = AbortSignal.timeout(20_000);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await request(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "Vibe-GNOME-Skill-Review/1.0",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location)
        throw new Error("skills.sh returned a redirect without a location.");
      const next = new URL(location, url);
      if (skillUrl(next.href).href !== target.href)
        throw new Error("skills.sh redirected to a different skill.");
      url = next.href;
      continue;
    }
    if (!response.ok)
      throw new Error(
        `skills.sh returned HTTP ${response.status}. Retry the check later.`,
      );
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("text/html")
    ) {
      throw new Error("skills.sh did not return an HTML audit page.");
    }
    if (!response.body) throw new Error("skills.sh returned an empty page.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("skills.sh page exceeded the 2 MiB review limit.");
      }
      html += decoder.decode(value, { stream: true });
    }
    return parseAudits(html + decoder.decode(), target.href);
  }
  throw new Error("skills.sh returned too many redirects.");
}

if (import.meta.main) {
  try {
    const report = await checkSkillAudits(process.argv[2] ?? "");
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Audit check failed.",
    );
    process.exitCode = 1;
  }
}
