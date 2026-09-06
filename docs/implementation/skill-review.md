# Skill submission and review

Submit one skill through `.github/ISSUE_TEMPLATE/submit-skill.yml`. The form asks
for its skills.sh page, matching GitHub source repository, an immutable SKILL.md
permalink, GNOME use case, installation example, license, submitter relationship,
and required permissions. Field headings used by the checker are an interface:
update `submissionTarget` and its tests when renaming them.

## Required audits

The skill's **Security Audits** on skills.sh must contain both:

| Provider | Required result |
| --- | --- |
| Gen Agent Trust Hub | PASS |
| Socket | PASS |
| Snyk | Informational; does not block review |

Only an explicit PASS from each required provider passes. WARN, FAIL, PENDING,
missing or unknown results, network errors, and unreadable pages block review.
Results are matched by provider and skill URL, not their display order. Submitter
checkboxes and screenshots never substitute for the automated check.

## GitHub Actions

`.github/workflows/review-skill.yml` runs on skill issues opened, edited, or
reopened, and supports manual retries with an `issue_number` input. It checks out
the default branch with persisted credentials disabled, installs Bun 1.3.14, and
runs `scripts/review-skill-submission.ts`. No project dependencies or submitted
skill code are installed or executed. The token has repository contents read and
issues write access; it cannot publish a catalog change.

The action creates missing labels and maintains one bot-owned results comment:

| Label | Meaning |
| --- | --- |
| `skill-submission` | Tracks the issue even if its title or form fields change |
| `skill:audits-pending` | A check is running or was interrupted; wait or retry |
| `skill:audits-blocked` | The two required PASS results could not be verified |
| `skill:awaiting-review` | Both required audits passed; a human decision is needed |

Every run clears previous ready/blocked labels and replaces the old comment with
a pending message before fetching audits. A final issue read rejects results if
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
   submission changed, or review resumes later, rerun the workflow first.
2. Open the linked skills.sh reports and immutable SKILL.md. Confirm the source,
   skill name/path, and submitted commit refer to the same skill. The sidebar
   verdicts do **not** prove the submitted commit was scanned. Compare audit
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
issue number. Re-running reads the latest issue body. If an old form lacks the
new fields, add them using [the submission example](../../examples/tool-submissions.md).
