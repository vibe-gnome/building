# Updating and accepting an existing skill issue

The Skills submission template has been removed. Existing skill issues in
`vibe-gnome/building` can still be reviewed, even if the skill is not listed on
skills.sh yet. GitHub Actions first tries a temporary install using
`npx skills add`, then verifies PASS for both Gen Agent Trust Hub and Socket
before human review. Snyk is informational.

This is copy-ready issue content for an older issue that needs the new fields.
The `owner`, repository, and skill name below are placeholders: replace them
with the actual skill. Set the folder path relative to the repository root;
use `.` if SKILL.md is in the root. Summary and tags may be omitted.

```markdown
### Skill name

GNOME Workflow

### Source repository URL

https://github.com/owner/gnome-workflow

### Skill folder path

.

### Tags

GNOME, GTK, Libadwaita

### Summary

Agent guidance for building and checking a Libadwaita app.
```

The workflow reads the selected SKILL.md at a pinned default-branch commit and
uses its frontmatter `name` to find the skills.sh page. An omitted Summary uses
its frontmatter `description`. Installation, license, permissions, and other
supporting information are reviewed directly in the repository.

Try the same temporary installation locally. This sends the CLI's public
installation telemetry to skills.sh and removes the installed files afterward:

```bash
bun scripts/install-review-skill.ts https://github.com/stonega/harness skills/gnome-svg-icons
```

Run the audit checker without installing or executing skill instructions:

```bash
bun scripts/check-skill-audits.ts https://skills.sh/vercel-labs/skills/find-skills
```

This prints current results and fails unless the two required providers pass.
To retry an issue check, use **Actions → Review skill submission → Run workflow**
on the default branch and enter the issue number.

Follow [the maintainer review steps](../docs/implementation/skill-review.md).
After reviewing the source revision, instructions, license, permissions, and
passing audits, copy `/publish-listing <fingerprint>` from the bot's latest
report into a new issue comment. Replace `<fingerprint>` with the exact hash
provided by that report; do not invent one.

The publication action checks your repository permissions, source revision, and both audits again,
then saves the listing and review evidence in D1. Its Actions summary links to
`/skills/<db-id>/gnome-workflow`. Refresh the page to see it; no source edit, PR, or rebuild
is required. Configure the publisher first using
[D1 catalog operations](../docs/implementation/catalog-storage.md).

The database assigns the numeric ID automatically. The readable URL segment comes
from the verified skills.sh page. Older manual Listing ID fields are ignored.
If upstream changes after review, rerun the review workflow and use its new
approval command.
