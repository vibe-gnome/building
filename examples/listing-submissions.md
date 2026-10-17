# Submit an app or extension with an agent

1. Open `/apps` or `/extensions` and select **Submit app** or **Submit extension**.
2. Select **Copy prompt** under **Submit with an agent**.
3. Paste it into your coding agent in the project you want to submit. The agent
   reads the repository and README, asks for missing required details, and uses
   its GitHub access to create an issue in `vibe-gnome/building`.
4. Open the returned issue URL and follow the automated checks. A maintainer
   reviews the submission before publication.

The live prompts are maintained in `app/lib/listing-submissions.ts` so their
field headings stay aligned with the GitHub forms. Print either prompt locally
without creating an issue:

```sh
bun -e 'import { listingSubmissionPrompt } from "./app/lib/listing-submissions.ts"; console.log(listingSubmissionPrompt("apps"))'
bun -e 'import { listingSubmissionPrompt } from "./app/lib/listing-submissions.ts"; console.log(listingSubmissionPrompt("extensions"))'
```

To submit manually, select **Open GitHub form** in the same dialog and fill in
the project name, public repository URL, summary, and optional tags.
