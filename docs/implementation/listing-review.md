# Maintainer Listing Review

For skills, follow the [skills.sh audit and human approval flow](skill-review.md).
The steps below apply to apps and extensions.

App submissions, extension submissions, and extension updates have two review
steps: automatic basic checks, then explicit human confirmation. Reports and
removal requests go directly to human triage so missing metadata cannot delay a
problem report.

## 1. Automatic basic checks

`.github/workflows/listing-review.yml` runs when an issue is opened, edited, or
reopened. It updates one bot comment and maintains one of these labels, preserving
unrelated issue labels:

| Label | Meaning |
| --- | --- |
| `review:needs-info` | Basic checks failed; edit the issue to fix the reported fields. |
| `review:needs-human` | Basic checks passed; a maintainer must review and confirm. |
| `review:confirmed` | A maintainer explicitly confirmed the checked submission. |

App checks cover name, public HTTPS project URL syntax, summary, installation and
usage instructions, and author/license attribution. Extension checks cover the
source URL, name, summary or requested changes, and submitter relationship, plus
the existing GNOME `metadata.json`:

- Valid JSON object, UUID format, matching name, and non-empty description.
- A non-empty list of unique Shell version strings (`3.38`, `45`, `50`, etc.).
- A positive integer `version` and HTTPS `url` when those optional fields appear.
- A GNOME listing URL on `extensions.gnome.org/extension/<number>/`, if supplied.
- New submissions must have a new UUID. Updates must match a catalog UUID and
  preserve it in any updated metadata. Listing corrections may omit unchanged
  metadata; a maintainer must verify that omission.

These checks follow the [GNOME metadata format](https://gjs.guide/extensions/overview/anatomy.html).
They inspect submitted text and URL syntax. They do not fetch submitted URLs,
check availability, validate license claims, install software, or execute
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
   A site rebuild and catalog PR are no longer needed. New app and extension
   submissions use their optional `Listing ID`, or `submission-<issue-number>`.
   Extension updates find the current D1 row by UUID and preserve its slug,
   original added date, icon, and view count.
6. Issue edits require new checks and human approval before they affect the
   published version. Submitted fields are plain text; instructions and code
   are never executed. Keep icon/screenshot attribution in the review record;
   adding new local image files still requires an asset deployment.

For report/removal issues, investigate the reason and verify the requester before
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
The basic-check job reads current extension identities from the catalog API.

Use the [copy-ready examples](../../examples/listing-review.md) for a local dry run:

```sh
bun scripts/listing-review.ts examples/listing-review/app.json
bun scripts/listing-review.ts examples/listing-review/extension.json
bun test tests/listing-review.test.ts
```

Dry runs print the report and exit nonzero when checks fail, without accessing
credentials or the network. In Actions, failed basic checks and refused
confirmations also fail the run after writing the report or run summary. API
errors fail the run; investigate the error before rerunning it.

Initial entries were sourced from the sibling Codex Usage Indicator and Kitty
Session Restorer projects and their public repositories. Their Shell support
is taken from GNOME metadata; it is not an independent compatibility guarantee.
