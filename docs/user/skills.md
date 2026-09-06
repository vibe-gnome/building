# Submit a skill

Open **Submit a skill** on the Skills directory. Submit one skill per GitHub
issue with a public source repository and its exact page on
[skills.sh](https://skills.sh).

On that page, **Gen Agent Trust Hub** and **Socket** must both show **PASS** under
**Security Audits**. Snyk is informational. If a required audit is missing,
pending, WARN, or FAIL, wait for passing results before submitting.

Include the source repository, a SKILL.md permalink pinned to a full commit SHA,
a short explanation of how the skill helps with GNOME development, installation
instructions and an example prompt, author/license, your relationship to the
project, and any required permissions or external services. All three links must
refer to the same skill. Do not paste credentials.

GitHub Actions checks skills.sh directly and posts the results on your issue.
A passing check moves the request to human review. A maintainer reads the skill,
checks its relevance and permissions, and approves the catalog change before it
appears on the site. Passing audits does not automatically publish a listing.

If the action reports a blocked check, correct the linked skill or issue fields.
Editing or reopening the issue runs the check again. For a temporary outage or
new audit results, ask a maintainer to rerun it. A screenshot cannot replace the
live check.
