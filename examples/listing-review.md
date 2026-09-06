# App and extension review examples

Run the basic checks on example issue bodies without contacting GitHub:

```sh
bun scripts/listing-review.ts examples/listing-review/app.json
bun scripts/listing-review.ts examples/listing-review/extension.json
```

Each JSON file has `title` and `body` keys. Copy one and replace its values with
the issue's title and Markdown body. The body uses the `### Field label` headings
GitHub generates from our issue forms. Extension metadata may be raw JSON or a
fenced JSON block. A failed check exits with status 1 and explains the missing or
invalid field; a passing report exits with status 0. No dependencies need to be
installed to run these scripts with Bun.

On GitHub, submit an app with `submit-app.yml`, an extension with
`submit-extension.yml`, or an existing extension update with
`update-extension.yml`. Once the action's report passes, a maintainer reviews the
upstream facts and copies the report's complete command into a new comment:

```text
/publish-listing <copy the complete fingerprint from the current bot report>
```

The placeholder above is not runnable: use the exact command generated for the
real issue. The publishing action checks the human's current write/admin access,
the issue fingerprint, and the passing bot report before storing the listing and
review evidence in D1. Check the Actions run summary for the published URL.
Editing the issue requires a new check and approval. The accepted version stays
published while an edit is reviewed.

Configure [D1 publication](../docs/implementation/catalog-storage.md) first.
The older `/confirm-listing` command records confirmation only and does not
publish. No source-code catalog edits or website rebuild are needed to publish.

For extensions, follow the [extension submission example](extension-submissions.md)
and [maintainer review steps](../docs/implementation/listing-review.md).

```sh
bun run check
bun run build
```
