# Extension submissions

Use the "Submit extension" action at `/extensions`. It opens the
`submit-extension.yml` GitHub issue form in `vibe-gnome/building`.
The existing GNOME `metadata.json` is the source for UUID, version,
description, and Shell compatibility.

Copy-ready submission outline (replace the example values with upstream facts):

```text
Extension name: My Extension
Listing ID: my-extension
Source repository: https://github.com/your-name/your-extension
GNOME Extensions listing: Leave empty unless published on extensions.gnome.org.
metadata.json: Paste the complete metadata.json from the release being submitted.
Summary: Describe what the extension does and any additional requirements.
Category and tags: Workflow, workspaces
Icon or screenshots: Link to the source assets and include license/attribution.
Your relationship to the extension: Author
```

For changes to an existing listing, open its detail page and select its update
or report link to open a GitHub issue. Its name, UUID, and source repository are prefilled.
Include the release or commit supporting the request. Submissions and updates
first receive automatic basic checks; edit the issue to fix any reported fields.
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
