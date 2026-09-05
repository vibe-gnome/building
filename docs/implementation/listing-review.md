# Maintainer Listing Review

1. Open the submission, update, or removal issue in `vibe-gnome/website`.
2. Verify the upstream source and requester's relationship to it. For updates,
   match the existing listing by GNOME UUID. Investigate report/removal reasons.
3. Read the extension's official GNOME `metadata.json`. Check UUID, name,
   description, version, and supported Shell versions against the linked release
   or commit. Use GNOME's existing extension guidance; do not require a custom
   manifest or execute extension code as part of catalog review.
4. Add or edit the matching object in `app/data/extensions.json`, or remove the
   listing for an approved removal. Keep its slug stable for updates. Preserve
   the original `added` date. Set `updated` from the source change being reviewed.
   Add optional `gnomeUrl` only for a verified extensions.gnome.org listing.
5. Use the author's actual icon or screenshot with attribution. Keep local icon
   files in `public/extensions/icons/` and attribution in `THIRD_PARTY_NOTICES.md`.
6. Run `bun run check` and `bun run build`. Review the resulting detail page.
7. Merge the catalog change referencing the issue and publish the static build.
   Close the issue with the resulting change reference.

Initial entries were sourced from the sibling Codex Usage Indicator and Kitty
Session Restorer projects and their public repositories. Their Shell support
is taken from GNOME metadata; it is not an independent compatibility guarantee.
