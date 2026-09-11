# Skills and existing submissions

Browse reusable agent guidance in the Skills directory. The Skills submission
template and directory submission button have been removed.

Existing GitHub skill issues remain supported by the review workflow. They use
the skill name, public GitHub repository URL, and path to the folder containing
SKILL.md. Use a path such as `skills/gnome-workflow`, or `.` when SKILL.md is at
the repository root.

The skill does not need to be listed on [skills.sh](https://skills.sh) yet.
Review first tries `npx skills add` for the selected skill in a temporary
directory. The CLI sends public installation data to skills.sh, which may need
time to index the skill and produce audits. The temporary installation is removed.
**Gen Agent Trust Hub** and **Socket** must both show **PASS** before human review.
Snyk is informational; installation alone does not approve the listing.

Summary and tags are optional. Leave Summary blank to use the description from
SKILL.md. Separate tags with commas, for example `GNOME, GTK, Libadwaita`.
The workflow reads SKILL.md from the default branch, finds the skills.sh page
using its declared name, and includes a link to the checked source revision in
the review report. You do not need to provide audit links or commit permalinks.

GitHub Actions posts installation and audit results on your issue. It briefly
retries missing or pending audits; rerun the workflow later if skills.sh is still
indexing or scanning the skill.
A passing check moves the request to human review. A maintainer reads the skill,
checks its relevance and permissions, and approves the catalog change before it
appears on the site. Passing audits does not automatically publish a listing.

If the action reports a blocked check, correct the linked skill or issue fields.
Editing or reopening the issue runs the check again. For a temporary outage or
new audit results or an updated repository, ask a maintainer to rerun it. A
repository revision change requires fresh checks and approval. A screenshot
cannot replace the live check.
