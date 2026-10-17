import type { ShowcaseCategory } from "./showcases";

export function listingSubmissionPrompt(category: ShowcaseCategory) {
  const isApp = category === "apps";
  const subject = isApp ? "GNOME app" : "GNOME Shell extension";
  const nameHeading = isApp ? "App name" : "Extension name";
  const repositoryHeading = isApp
    ? "Repository or project URL"
    : "Source repository";

  return `Submit this project's ${subject} to Vibe GNOME by creating a GitHub issue in https://github.com/vibe-gnome/building.

Read the project's repository and README to find its name, public repository URL, a short factual summary${isApp ? "" : " (including any additional requirements)"}, and optional comma-separated tags. Use the repository root on GitHub, GitLab.com, or GNOME GitLab. Ask me for any missing required information; do not invent details.

Use the title "${isApp ? "[App]" : "[Submit]"} <project name>" and this issue body, replacing the placeholders with verified project details and keeping the headings exactly as written:

\`\`\`markdown
### ${nameHeading}
<project name>

### ${repositoryHeading}
<public repository URL>

### Tags
<comma-separated tags, or leave blank>

### Summary
<what the project does and who it is for>
\`\`\`

${isApp ? "The app ID is" : "The extension UUID and metadata.json are"} detected automatically from the repository. Create the issue using your available GitHub tools and return its URL. The submission will receive automated checks and needs maintainer review before it is listed.`;
}
