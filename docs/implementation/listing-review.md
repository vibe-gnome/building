# Maintainer Listing Review

For skills, follow the [skills.sh audit and human approval flow](skill-review.md).
The steps below apply to apps and extensions.

App submissions, extension submissions, and existing extension update issues have two review
steps: automatic basic checks, then explicit human confirmation. Reports and
removal requests go directly to human triage so missing metadata cannot delay a
problem report.

The extension update issue template has been removed. New listing corrections
use **Report listing** on the extension detail page for human triage. Existing
update issues remain supported by the review and publication workflows.

## 1. Automatic basic checks

`.github/workflows/listing-review.yml` runs when an issue is opened, edited, or
reopened. Maintainers can also choose **Actions → Listing review → Run workflow**
on the default branch and enter the issue number to refresh repository discovery
without editing the submission. The number must be a positive integer without
leading zeros. The job runs its focused tests before reading the current issue
and updating one bot comment. It maintains one of these labels, preserving
unrelated issue labels:

| Label | Meaning |
| --- | --- |
| `review:needs-info` | Basic checks failed; edit the issue to fix the reported fields. |
| `review:needs-human` | Basic checks passed; a maintainer must review and confirm. |
| `review:confirmed` | A maintainer explicitly confirmed the checked submission. |

App submissions request only name, repository URL, and summary. The repository
must be a public root URL on GitHub, GitLab.com, or GNOME GitLab. Live checks read
the default branch at a single commit and detect the native app ID from
AppStream `.metainfo.xml` / `.appdata.xml` files (including `.in` templates),
falling back to a reverse-DNS `.desktop` filename with `Type=Application`.
AppStream takes precedence over helper desktop launchers. Test, example, vendor,
and subproject directories are excluded. Missing or conflicting IDs, incomplete
repository trees, unsupported hosts, and fetch errors require changes before
approval. Discovery does not guess an ID from the app name or issue number.

The report shows the detected ID and a source permalink. App approval fingerprints
cover the issue and the resolved ID, repository, commit, and source path.
Publication repeats discovery; a changed repository revision requires fresh
checks and approval. Use the manual workflow rerun to obtain the new command.
Older app issues' `Listing ID` fields are ignored.
Installation instructions and author/license attribution are verified by
maintainers in the upstream project during review.

Extension submission checks cover the source URL, name, summary, and the GNOME
`metadata.json` read from the default branch at a pinned commit. New submissions
have no listing ID, UUID, GNOME listing URL, pasted metadata, or submitter
relationship field. Removed fields in older submissions are ignored. Screenshots
are optional and retained verbatim in the approved issue evidence. Existing update issues still require requested changes and submitter
relationship. Exactly one metadata.json
must exist outside excluded test/example/vendor directories; missing, ambiguous,
templated UUIDs and fetch errors block approval. Repository roots use the same
hosts as apps. Review and publication bind the UUID, repository, commit and path
to the fingerprint and retain the detected metadata in the review evidence.
Validation covers:

- Valid JSON object, UUID format, matching name, and non-empty description.
- A non-empty list of unique Shell version strings (`3.38`, `45`, `50`, etc.).
- A positive integer `version` and HTTPS `url` when those optional fields appear.
- For existing update issues, a GNOME listing URL on
  `extensions.gnome.org/extension/<number>/`, if supplied.
- New submissions must have a new UUID. Updates must match a catalog UUID and
  preserve it in any updated metadata. Listing corrections may omit unchanged
  metadata; a maintainer must verify that omission.

These checks follow the [GNOME metadata format](https://gjs.guide/extensions/overview/anatomy.html).
New extension and app identity discovery reads public metadata through host APIs without credentials, following no redirects.
Reads have time and size limits; at most 20 metadata candidates are inspected.
These checks do not validate license claims, install software, or execute
submitted code. Passing is not a compatibility or safety guarantee.

## 2. Human confirmation

1. Open the issue in `vibe-gnome/building` and wait for the latest basic report to
   pass. Fixes belong in the issue body; edits rerun the checks.
2. Verify the linked upstream source, requester's relationship, author/license,
   installation instructions, and listing suitability. For extensions, compare
   the official `metadata.json` against the linked release or commit and use
   [GNOME's extension guidance](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
   Do not require a custom manifest or execute extension code for catalog review.
3. A human maintainer with repository write/admin access copies
   `/publish-listing <fingerprint>` from the passing bot report into a **new
   issue comment** to approve and publish the checked submission. The action
   verifies current permissions, the bot report, and the latest title/body.
   The older `/confirm-listing` command only records confirmation; it does not
   publish data. Use `/publish-listing` for the complete approval/publication flow.
4. Wait for the successful **Publish reviewed listing to D1** run. Its summary
   links to the published page. D1 records the listing, issue content, approving
   maintainer, approval comment, and revision together. Bots, read/triage users,
   edited commands, and obsolete fingerprints cannot publish.
5. Inspect the live listing and close the issue with the workflow/page link.
   A site rebuild and catalog PR are no longer needed. Links use
   `/<category>/<db-id>/<name-id>`, with the app domain or extension UUID namespace
   removed from the readable suffix. Listing IDs are assigned automatically.
   Older URLs redirect and retain their view counts.
   Extension updates find the current D1 row by UUID and preserve its slug,
   original added date, icon, and view count.
6. Issue edits require new checks and human approval before they affect the
   published version. Submitted fields are plain text; instructions and code
   are never executed. Keep icon/screenshot attribution in the review record;
   adding new local image files still requires an asset deployment.

The removal/report form has no Extension UUID or Reason field. Discuss the request and verify the requester before
unpublishing the D1 row through the procedure in
[catalog operations](catalog-storage.md). Keep its review history and view count.

## Installation and local checks

Publish both review and publishing workflows, their imported scripts/modules, and issue forms on the
repository's default branch. Enable GitHub Actions and allow its `GITHUB_TOKEN`
to use `contents: read` and `issues: write`. No personal token, environment
approval configuration, or manually created labels are needed. The workflow
creates review labels on first use, runs pinned actions and trusted default-branch
code, and does not install project dependencies. Existing open issues are checked
on their next edit or reopening. Do not run the `--github` mode locally to test it:
that mode writes issue comments and labels.

Configure the publishing job using [D1 catalog operations](catalog-storage.md).
Apply `0005_listing_ids.sql` before deploying the new API/routes or publishing,
and `0004_app_identity.sql` before app publication. Review and publishing jobs
share a per-issue lock, use Bun 1.3.14, and check out trusted default-branch code.
The basic-check job reads current extension identities from the catalog API.
Both jobs run `tests/extension-submission-workflow.test.ts` before their credentialed
steps. It builds an issue from the current form and exercises review, approval,
publication, and screenshot evidence with mocked GitHub/repository reads and a
local SQLite database, without external services.

Use the [copy-ready examples](../../examples/listing-review.md) for a local dry run:

```sh
bun scripts/listing-review.ts examples/listing-review/app.json
bun scripts/listing-review.ts examples/listing-review/extension.json
bun test tests/listing-review.test.ts
```

Dry runs validate fields and print a report without accessing credentials or the
network. New app/extension dry runs do not perform identity discovery or issue approval commands.
Use `bun examples/resolve-app-id.ts https://github.com/mhagrelius/planner` to test
public metadata discovery separately; this reads the repository without creating
an issue or executing its code. In Actions, failed basic checks and refused
confirmations also fail the run after writing the report or run summary. API
errors fail the run; investigate the error before rerunning it.

Initial entries were sourced from the sibling Codex Usage Indicator and Kitty
Session Restorer projects and their public repositories. Their Shell support
is taken from GNOME metadata; it is not an independent compatibility guarantee.
