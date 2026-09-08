# Extension submissions

Use the "Submit extension" action at `/extensions`. It opens the
`submit-extension.yml` GitHub issue form in `vibe-gnome/building`.
The existing GNOME `metadata.json` is the source for UUID, version,
description, and Shell compatibility. The workflow reads this file from a pinned
commit in the public repository; no UUID or pasted metadata is requested. The
repository must contain exactly one metadata.json outside test/example/vendor
directories. GitHub, GitLab.com, and GNOME GitLab roots are supported.

For apps and extensions hosted on GitHub, a custom repository social preview
image is imported automatically as the listing screenshot. Set it under the
upstream repository's **Settings > General > Social preview** before review.
Generated GitHub cards are omitted. The detected image URL appears in the review
report; changing it requires fresh checks and approval.

Copy-ready submission outline (replace the example values with upstream facts):

```text
Extension name: My Extension
Source repository: https://github.com/your-name/your-extension
Tags: workflow, workspaces
Summary: Describe what the extension does and any additional requirements.
```

For changes to an existing listing, open its detail page and select **Report
listing** to open a GitHub issue for human triage. Its name and source repository
are prefilled. Include the release or commit supporting the request in the issue discussion.
New submissions first receive automatic basic checks; edit the issue to fix any reported fields.
A maintainer then reviews the source and posts the `/publish-listing` command
from the passing report. The publishing action rechecks the submission and writes
the accepted record and review evidence to D1. It appears without rebuilding the
website. Reports and removal requests go directly to human triage.

See [local review examples](listing-review.md) to run the metadata checks without
creating an issue or posting to GitHub.

To query the reviewed catalog locally:

```sh
bun examples/catalog-query.ts
```

The example searches for Kitty extensions compatible with GNOME Shell 50.
See [listing review](../docs/implementation/listing-review.md) for acceptance.

New links use `/extensions/<db-id>/<uuid-before-@>`. The database assigns the ID,
and legacy URLs redirect while retaining view counts. The report/removal form
has no Extension UUID or Reason field; maintainers can discuss the request in the issue.

Preview repository discovery without writing to GitHub:

```sh
bun examples/resolve-extension-id.ts https://github.com/stonega/codex-usage-indicator
```
