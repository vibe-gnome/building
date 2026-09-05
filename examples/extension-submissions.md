# Extension submissions

Use the "Submit extension" action at `/extensions`. It opens the
`submit-extension.yml` GitHub issue form in `vibe-gnome/website`.
The existing GNOME `metadata.json` is the source for UUID, version,
description, and Shell compatibility.

Copy-ready submission outline (replace the example values with upstream facts):

```text
Extension name: My Extension
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
Include the release or commit supporting the request. A maintainer reviews
the issue before updating `app/data/extensions.json` and publishing a build.

To query the reviewed catalog locally:

```sh
bun examples/catalog-query.ts
```

The example searches for Kitty extensions compatible with GNOME Shell 50.
See [listing review](../docs/implementation/listing-review.md) for acceptance.
