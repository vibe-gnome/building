# Skill submission and review

Submit one skill through `.github/ISSUE_TEMPLATE/submit-skill.yml`. The form asks
for its name, public GitHub source repository, and skill folder path relative to
the repository root (`.` for a root-level SKILL.md). Summary and comma-separated
tags are optional. It does not ask for audit links, commit permalinks, installation
instructions, attribution, submitter relationship, permissions, or checkboxes.
Maintainers review those details in the upstream source. Field headings used by
the checker are an interface: update `resolveSkillTarget`, `submissionTarget`,
and their tests when renaming them.

`app/server/skill-identity.ts` reads the selected folder's regular SKILL.md from
the default branch at one commit, using the bounded public reads shared with
app and extension discovery. It parses YAML frontmatter with Bun, derives the
skills.sh URL from the repository and declared `name`, and uses `description`
when Summary is blank. The display name need not be the folder name. Missing
files, invalid metadata, and incomplete trees block review. Identity discovery
reads the selected SKILL.md; installation then copies that skill's files into a
temporary directory without executing its instructions. The report links to its
immutable source. Approval covers the repository, commit, path, and skill name
as well as the issue. Publication resolves them again and rejects a changed
revision until checks and approval are refreshed. Tags are trimmed, empty tags
removed, and duplicates collapsed before storage; they appear on cards and
detail pages. Existing listings without tags remain supported.

Older issues with skills.sh URL and SKILL.md permalink fields remain supported.
Their repository/permalink validation still applies; removed descriptive fields
are no longer required for publication.

The form has no Listing ID. D1 assigns a stable numeric ID, and the final
segment of the verified skills.sh URL supplies the readable name in
`/skills/<db-id>/<skill-name>`. Older manual IDs are ignored; previously published
skills keep their internal key and view counts when republished.

## Installation before audits

Skills may be submitted before they appear on skills.sh. After validating the
repository and folder, `scripts/install-review-skill.ts` runs `npx --yes
--ignore-scripts skills@1.5.25 add <repository>/tree/<commit>/<folder> --skill
<declared-name> --agent codex --copy --yes`. Root skills omit the folder suffix.
The CLI version and full source commit are pinned. Legacy submissions use their
validated SKILL.md permalink's commit and folder.

The child process uses a fresh temporary project, home, Git configuration, and
npm cache; it inherits no GitHub/Cloudflare tokens, npm credentials, SSH agent,
or workflow output paths. npm lifecycle scripts are disabled. The selected
skill's files are copied, not executed or loaded into a running agent. A
two-minute timeout terminates the process group. CLI output is suppressed so
repository content cannot emit workflow commands; failures report a fixed
message and exit code. The installed SKILL.md name and lockfile repository,
commit, and folder must match the reviewed target. Temporary files are always
removed, including on failure.

The CLI's public installation telemetry remains enabled and identifies this as
CI. Explicit `DO_NOT_TRACK` or `DISABLE_TELEMETRY` settings are respected. A
successful install does not prove that telemetry was accepted, the skill was
indexed, or the reviewed commit was scanned. Review tries the skills.sh page up
to three times, 15 seconds apart, for HTTP 404 or pending/unknown required
audits. WARN/FAIL results and other request failures block immediately. If
indexing or audits are still unavailable, the issue records the successful
installation but stays blocked until a later review run passes.

## Required audits

The skill's **Security Audits** on skills.sh must contain both:

| Provider | Required result |
| --- | --- |
| Gen Agent Trust Hub | PASS |
| Socket | PASS |
| Snyk | Informational; does not block review |

Only an explicit PASS from each required provider passes. WARN, FAIL, PENDING,
missing or unknown results, network errors, and unreadable pages block review.
Results are matched by provider and skill URL, not their display order.
Screenshots never substitute for the automated check.

## GitHub Actions

`.github/workflows/review-skill.yml` runs on skill issues opened, edited, or
reopened, and supports manual retries with an `issue_number` input. It checks out
the default branch with persisted credentials disabled, installs Node.js 22 and
Bun 1.3.14, and runs `scripts/review-skill-submission.ts`. The pinned skills CLI
runs only in the temporary installation described above. The workflow has an
eight-minute limit. The token has repository contents read and
issues write access; it cannot publish a catalog change.

The action creates missing labels and maintains one bot-owned results comment:

| Label | Meaning |
| --- | --- |
| `skill-submission` | Tracks the issue even if its title or form fields change |
| `skill:audits-pending` | A check is running or was interrupted; wait or retry |
| `skill:audits-blocked` | The two required PASS results could not be verified |
| `skill:awaiting-review` | Both required audits passed; a human decision is needed |

Every run clears previous ready/blocked labels and replaces the old comment with
a pending message before installation and audit checks. A final issue read rejects results if
the body, title, or open state changed during the check. Runs are serialized per
issue; a new run does not cancel an active run halfway through its writes. The
final comment and Actions summary contain individual verdicts, links, check time,
and a workflow-run link. A blocked result fails the job.

The public HTML page is used because the documented
[skills.sh audit API](https://www.skills.sh/docs/api) requires Vercel OIDC
authentication. This issue workflow needs no skills.sh secret or Vercel project.
`scripts/check-skill-audits.ts` uses Bun's HTMLRewriter to read only the rendered
metadata sidebar's audit links; it ignores skill prose and serialized scripts.
Requests are restricted to HTTPS skills.sh skill pages, with same-skill redirects,
a 20-second request deadline and a 2 MiB response limit. The GitHub token is sent
only to GitHub, never to skills.sh.

The HTML layout is an external dependency, not a stable API contract. If it
changes, checks block until a maintainer updates the selector and deterministic
fixture in `tests/fixtures/skill-audits.html`. Never treat a parsing failure as a
pass. Diagnose without writing to GitHub:

```bash
bun scripts/check-skill-audits.ts https://skills.sh/vercel-labs/skills/find-skills
bun test tests/skill-audits.test.ts
```

The first command prints current results as JSON and exits nonzero on a blocked
check. Tests use local fixtures and mocked network/GitHub responses.

## Human approval and publication

1. Confirm the latest workflow run passed and the issue has
   `skill:awaiting-review`, without a pending/blocked label. If the skill or
   submission changed, or review resumes later, rerun the workflow first. A new
   upstream commit also requires a fresh check and approval command.
2. Open the report's linked skills.sh reports and immutable SKILL.md. Confirm the source,
   skill name/path, and resolved commit refer to the same skill. The sidebar
   verdicts do **not** prove the resolved commit was scanned. Compare audit
   dates and revision information in the provider reports against the source;
   defer approval if the reviewed content changed after the scan or its identity
   cannot be established.
3. Review GNOME relevance, instructions, commands, downloads, file writes,
   external services, credential requirements, license, and attribution. Read
   supporting files too. Discuss Snyk findings as context; they do not change the
   two-provider automated requirement. Do not execute skill code merely to
   review it.
4. Copy `/publish-listing <fingerprint>` from the latest passing report into a
   new issue comment. This is the human approval and publication command. It
   requires repository write/admin access; a label or checkbox cannot approve.
5. The publishing action revalidates the issue, fetches both required audits
   again, and writes the accepted listing and review evidence to D1 atomically.
   Wait for the successful **Publish reviewed listing to D1** run, inspect the
   published skill page, and close the issue with its run/page links. No catalog
   PR or site rebuild is needed. Rejection means closing without publishing.
6. A subsequent issue edit requires fresh checks and a new approval command.
   The previously published version stays visible until another version is
   approved. Never execute a submitted skill during catalog review.

## Activation

Publish the issue form, workflows, and their imported scripts/modules to `vibe-gnome/building`'s
default branch. Issues and Actions must be enabled, and repository/organization
policy must allow the job's `issues: write` token permission. No custom token is
needed. Issue-event workflows only run when the workflow exists on the default
branch, as described in [GitHub's event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

Configure the separate publishing workflow's Cloudflare variables and D1 write
secret as described in [D1 catalog operations](catalog-storage.md). The audit
workflow has no database write credential. Human publication permission is
checked through GitHub's current repository permissions.

For an existing submission or a transient skills.sh outage, open **Actions →
Review skill submission → Run workflow**, use the default branch, and enter the
issue number. Re-running reads the latest issue body and, for folder submissions,
the latest repository revision. To switch an old issue to the simpler form, use
[the submission example](../../examples/tool-submissions.md).
