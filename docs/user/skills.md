# Submit a skill

Open **Submit a skill** on the Skills directory. Submit one skill per GitHub
issue with its name, public GitHub repository URL, and the path to the folder
containing SKILL.md. Use a path such as `skills/gnome-workflow`, or `.` when
SKILL.md is at the repository root.

On the skill's [skills.sh](https://skills.sh) page, **Gen Agent Trust Hub** and **Socket** must both show **PASS** under
**Security Audits**. Snyk is informational. If a required audit is missing,
pending, WARN, or FAIL, wait for passing results before submitting.

Summary and tags are optional. Leave Summary blank to use the description from
SKILL.md. Separate tags with commas, for example `GNOME, GTK, Libadwaita`.
The workflow reads SKILL.md from the default branch, finds the skills.sh page
using its declared name, and includes a link to the checked source revision in
the review report. You do not need to provide audit links or commit permalinks.

GitHub Actions checks skills.sh directly and posts the results on your issue.
A passing check moves the request to human review. A maintainer reads the skill,
checks its relevance and permissions, and approves the catalog change before it
appears on the site. Passing audits does not automatically publish a listing.

If the action reports a blocked check, correct the linked skill or issue fields.
Editing or reopening the issue runs the check again. For a temporary outage or
new audit results or an updated repository, ask a maintainer to rerun it. A
repository revision change requires fresh checks and approval. A screenshot
cannot replace the live check.
