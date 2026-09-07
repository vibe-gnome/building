# Submitting and accepting a skill

Use the **Submit a skill** issue form in `vibe-gnome/building`. Before submitting,
the skill's page on skills.sh must show PASS for both Gen Agent Trust Hub and
Socket. Snyk is informational. GitHub Actions verifies the live results before
a human maintainer reviews the request.

This is copy-ready issue content for an older issue that needs the new fields.
The `owner`, repository, skill name, and commit below are placeholders: replace
them with the actual skill and immutable commit being submitted.

```markdown
### Skill name

GNOME Workflow

### Source repository URL

https://github.com/owner/gnome-workflow

### skills.sh URL

https://skills.sh/owner/gnome-workflow/gnome-workflow

### SKILL.md permalink

https://github.com/owner/gnome-workflow/blob/0123456789abcdef0123456789abcdef01234567/SKILL.md

### Summary

Agent guidance for building and checking a Libadwaita app.

### Installation and usage

Follow the repository's installation guide for your agent. Requires the GTK and
Libadwaita development packages. Example prompt: "Review this app's keyboard
navigation and suggest changes that follow GNOME conventions."

### Author and license

Project author; MIT (verify against the repository license).

### Your relationship to the skill

Author

### Permissions and external services

Reads the app source and suggests local edits. No credentials or external
services required. Replace this with the skill's actual requirements.

### Review requirements

- [x] Gen Agent Trust Hub and Socket both show PASS on the linked skills.sh page.
- [x] The links identify the same skill; human approval is required.
```

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

The publication action checks your repository permissions and both audits again,
then saves the listing and review evidence in D1. Its Actions summary links to
`/skills/<db-id>/gnome-workflow`. Refresh the page to see it; no source edit, PR, or rebuild
is required. Configure the publisher first using
[D1 catalog operations](../docs/implementation/catalog-storage.md).

The database assigns the numeric ID automatically. The readable URL segment comes
from the verified skills.sh page. Older manual Listing ID fields are ignored.
