# Submitting and accepting a skill

Use the **Submit a skill** issue form in `vibe-gnome/building`. Before submitting,
the skill's page on skills.sh must show PASS for both Gen Agent Trust Hub and
Socket. Snyk is informational. GitHub Actions verifies the live results before
a human maintainer reviews the request.

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

### Summary

Agent guidance for building and checking a Libadwaita app.

### Tags

GNOME, GTK, Libadwaita
```

The workflow reads the selected SKILL.md at a pinned default-branch commit and
uses its frontmatter `name` to find the skills.sh page. An omitted Summary uses
its frontmatter `description`. Installation, license, permissions, and other
supporting information are reviewed directly in the repository.

Run the audit checker without creating an issue or executing skill instructions:

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
