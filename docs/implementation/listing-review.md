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

App submissions request name, repository URL, optional comma-separated tags, and summary. The repository
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

App icon discovery uses that same tree and commit, matching the full native app
ID, its last component, the repository name, or `icon`, `logo`, and `app` image
names. It checks beside the metadata and in root branding directories (`assets`,
`data`, `resources`, `res`, `icons`, and `images`), including GNOME
`icons/hicolor/scalable/apps` and sized icon layouts. Full-color icons take
precedence over symbolic variants, then more specific names, proximity to
metadata, SVG/PNG/WebP/JPEG format preference, and larger declared raster sizes.
Equal-ranked choices are omitted. Symlinks, excluded directories, and files
reported over 1 MiB are ignored. No additional image fetch is required.
The report links the selected raw image URL, pinned to the reviewed commit.
That URL is included in the approval fingerprint and stored in the listing and
review evidence. App cards and detail pages preserve its colors; missing or
broken icons use `/icons/showcase/apps.svg`. Image bytes stay in the upstream
repository. Existing app listings receive icons on their next reviewed
publication.

Both app and extension forms place optional `Tags` above `Summary`. Extension
submissions no longer ask for a category; all comma-separated values are tags.

Extension submission checks cover the source URL, name, summary, and the GNOME
`metadata.json` read from the default branch at a pinned commit. New submissions
have no listing ID, UUID, GNOME listing URL, pasted metadata, screenshots, or submitter
relationship field. Removed fields in older submissions are ignored; the full
approved issue body is retained in review evidence. Existing update issues still require requested changes and submitter
relationship. Exactly one metadata.json
must exist outside excluded test/example/vendor directories; missing, ambiguous,
templated UUIDs and fetch errors block approval. Repository roots use the same
hosts as apps. Review and publication bind the UUID, repository, commit and path
to the fingerprint and retain the detected metadata in the review evidence.
Icon discovery uses the same repository tree and commit. It prefers `icon`,
`logo`, UUID, repository-name, or `extension` images next to metadata or in the
repository root, including `assets`, `data`, `resources`, `icons`, and `images`
directories. A lone image in an icon directory is also accepted; ambiguous
choices use the default green Extensions puzzle icon. SVG, PNG, WebP, and JPEG
are supported; symlinks, excluded directories, and files reported over 1 MiB
are ignored. The report links the selected image, and its immutable raw URL is
included in the approval fingerprint and saved with the listing. Browsers load
it as an image, falling back to the puzzle icon on load failure. No image bytes
are copied into D1 or the site repository.

For both apps and extensions, preview discovery first reads `README.md`,
`README.markdown`, or `README` from the reviewed repository commit, checking the
root, `.github/`, then `docs/`. Markdown images (including linked and reference
images) and HTML `<img src>` elements are supported; code fences and comments do
not supply images. Relative links resolve beside their README. Same-repository
raw/blob links on the default branch or reviewed commit are rewritten to the
reviewed commit and must refer to regular files in the already-filtered tree.

The first qualifying image in document order becomes `screenshot`. Discovery
skips obvious badge/icon/logo/avatar names and checks **actual image bytes** with
`image-size`: PNG, JPEG, WebP, and GIF must be at least **480 pixels wide and 270
pixels high**. README width/height attributes and MIME claims cannot satisfy this
check. SVG and other formats, unreadable images, and images over 5 MiB are skipped.
At most eight unique candidates are downloaded, each with a five-second timeout
within a shared 30-second image-check budget. README reads retain the 256 KiB
metadata limit. Symlinks and excluded repository directories remain ineligible.

Public uploads on `user-images.githubusercontent.com` and
`repository-images.githubusercontent.com` are also eligible. Other external
hosts and redirected images are skipped; image requests send no credentials.
GitHub token authentication applies only to the repository API reads.

If no README image qualifies, GitHub repositories fall back to the custom social
preview (`og:image` in the page head), with the same format, byte-size, and minimum
dimension checks. Only uploaded images on `repository-images.githubusercontent.com`
are accepted; generated cards and avatars are omitted. The HTML page fetch uses
a 15-second timeout and 2 MiB limit; the fallback image has a ten-second timeout.
GitLab repositories can use README images but have no social-preview fallback.
Missing previews and fetch failures do not block otherwise valid identities.

`marked` parses README Markdown and the existing HTMLRewriter inspects image
attributes without executing scripts or rendering repository HTML. `image-size`
reads image dimensions without a browser or native decoder. These two review-time
dependencies are locked in `bun.lock`; review/publication workflows install them
with `bun install --frozen-lockfile --ignore-scripts` before running tests.

The preview URL is linked in the report and included in the approval fingerprint.
Publication repeats discovery and requires the same selected URL, then stores it
in the listing and review evidence. Repository images are pinned to Git history;
uploaded/social previews are bound by URL separately from the repository revision.
Detail pages show the full image and hide it if loading fails. Image bytes are
only inspected during review/publication; they are not copied into D1 or the site.

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
New extension and app identity discovery reads public metadata through host APIs,
following no redirects. In Actions, review and publication use the existing
`GITHUB_TOKEN` for repository requests to `https://api.github.com` to avoid the
shared anonymous rate limit. The token is never sent to repository HTML pages,
image hosts, or GitLab. Authenticated lookups still reject private repositories.
API failures include the upstream JSON error message when available; rate-limit
responses include a retry time when supplied. Rerun **Listing review** for the
issue after the indicated delay. No additional secret is needed for this lookup.
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
   `/confirm-listing <fingerprint>` also publishes: the listing review job verifies
   confirmation, then runs the publisher under the same issue lock. Its publishing
   step receives the same Cloudflare variables and secret as the dedicated job.
4. Wait for the successful publication step in **Listing review** (confirmation)
   or **Publish reviewed listing to D1** (publication command). Its summary
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

If an older confirmation only recorded approval, or publication failed after
approval, run **Publish reviewed listing to D1** manually on the default branch.
Enter the issue number and the numeric approval comment ID from the comment's
`#issuecomment-<id>` URL. The workflow reads that original, unedited comment from
GitHub and rechecks the author's current permissions, current fingerprint, passing
report, and repository revision. Manual dispatch cannot approve on someone's behalf
or reuse an edited comment. Retrying an already-published approval does not write twice.

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
publication, and repository icon handling with mocked GitHub/repository reads and a
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
