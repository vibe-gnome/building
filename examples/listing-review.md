# App and extension review examples

Run the basic checks on example issue bodies without contacting GitHub:

```sh
bun scripts/listing-review.ts examples/listing-review/app.json
bun scripts/listing-review.ts examples/listing-review/extension.json
```

Each JSON file has `title` and `body` keys. Copy one and replace its values with
the issue's title and Markdown body. The body uses the `### Field label` headings
GitHub generates from our issue forms. New extension metadata is discovered from the repository in Actions. A failed check exits with status 1 and explains the missing or
invalid field; a passing report exits with status 0. No dependencies need to be
installed to run these scripts with Bun.

New app and extension field checks are offline; repository ID discovery runs separately in the
GitHub workflow. The app form needs only its name, repository root URL, and
summary. To preview ID discovery against a public repository:

```sh
bun examples/resolve-app-id.ts https://github.com/mhagrelius/planner
```

This prints the native ID, repository, pinned commit, and metadata path. Planner's
ID is `us.hagreli.Planner`, producing `/apps/<db-id>/planner` after publication. GitHub,
GitLab.com, and GNOME GitLab repository roots are supported. If no concrete
AppStream or desktop ID is found, or more than one app ID is found at the selected
metadata priority, the lookup fails with a reason. The script does not write to
GitHub, publish a listing, or execute repository code.

On GitHub, submit an app with `submit-app.yml` or an extension with
`submit-extension.yml`. Once the action's report passes, a maintainer reviews the
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

For new apps and extensions, the command also approves the detected identity and repository revision. If
the upstream default branch changes, choose **Actions → Listing review → Run
workflow** on the default branch, enter the issue number, then use the new command.
Reopening or editing the issue also reruns checks. Database IDs remain stable when republished. The publisher requires migration
`0005_listing_ids.sql`, plus `0004_app_identity.sql` for apps. Legacy URLs redirect
to the new path without changing view counts.

Configure [D1 publication](../docs/implementation/catalog-storage.md) first.
The `/confirm-listing` command also approves and publishes using the same
fingerprint. No source-code catalog edits or website rebuild are needed to publish.

To retry an existing approval after resolving a deployment or credential problem:

```sh
gh workflow run publish-listing.yml --repo vibe-gnome/building --ref main \
  -f issue_number=4 -f approval_comment_id=5579245292
```

Use the issue and comment IDs from the approved submission. The original comment
must be unedited and its fingerprint must still match the issue and repository.

For extensions, follow the [extension submission example](extension-submissions.md)
and [maintainer review steps](../docs/implementation/listing-review.md).

```sh
bun run check
bun run build
```
