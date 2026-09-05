# Architecture

Vibe GNOME is a standalone React Router v7 application using framework mode with
server rendering disabled. It produces a static client build that can be hosted
on any static web host. The production deployment uses Cloudflare Workers Static
Assets, with `vibe-gnome.org` attached as a Worker Custom Domain.

## Main pieces

- `app/routes/about.tsx` explains the community project's purpose at `/about`,
  which is prerendered as static HTML.
  Home and About share `app/components/site-footer.tsx`, including the About
  entry, community links, and independent-project disclaimer.
- `app/root.tsx` owns the document shell, metadata, global stylesheet, and an
  inline pre-paint preference script.
- `app/routes/home.tsx` owns the guide page, resource data, and copyable prompt
  window. `app/components/appearance-control.tsx` provides the shared appearance
  control used by the guide and extension pages.
- The community directories at `/apps`, `/extensions`, and `/skills`
  share `app/routes/community-layout.tsx` for their shell and
  `app/extensions.css` for their catalog presentation.
- `app/lib/tools.ts` owns the Skills directory's reviewed entries and GitHub
  issue submission links.
- `app/components/blur-glow-hero.tsx` mounts the hero's WebGL renderer and owns
  its resize, visibility, reduced-motion, and cleanup lifecycle.
- `app/lib/blur-glow/` contains the framework-independent word-mask, palette,
  shader, and multi-pass bloom engine.
- `app/lib/preferences.ts` is the source of truth for supported themes, GNOME
  accents, validation, and prompt copy.
- `app/app.css` defines the theme tokens and responsive presentation.

User appearance choices are stored locally. System mode listens for operating
system color-scheme changes. The pre-paint script applies saved preferences
before React loads to avoid a light/dark flash.

## Design direction

The site borrows GNOME's restraint rather than reproducing desktop widgets
literally. It uses system-first Adwaita/Cantarell typography, neutral surfaces,
compact controls, clear focus states, and the official nine-color accent
family. The prompt is the only elevated panel; guide sections use simple rules
and grouped lists instead of decorative cards. Practical app and extension ideas
alternate as labeled conversation bubbles inside a gravity stage. Matter.js gives
them real gravity, collisions, and free rotation so they remain loosely piled at
the bottom rather than snapping into a regular list. The enlarged hero statement
sits above the prompt panel in a single centered column at every viewport width.

The layout is responsive at tablet and phone widths and respects
`prefers-reduced-motion`.

The hero is progressively enhanced. Its semantic heading remains available to
assistive technology and is the visible fallback when WebGL is unavailable. Its
visual fallback stays hidden while WebGL readiness is pending, preventing a
duplicate-text flash before the green-and-gold canvas is ready.
The renderer caps device pixel ratio at 1.5, pauses outside the viewport, and
renders a single still frame when reduced motion is requested.

## Tool submissions

Skills are submitted through a category-specific GitHub issue form in
`vibe-gnome/website`. Maintainers review submissions and add accepted entries to
`app/lib/tools.ts`; the site does not automatically publish issue content or fetch
GitHub data in the browser. Forms live in `.github/ISSUE_TEMPLATE/` and become
available when published to the repository's default branch.

## Extension catalog

The former standalone extension marketplace is part of this application:
`/extensions` lists reviewed extensions, and `/extensions/:slug` shows each
extension's details. All submissions and listing changes use GitHub issues.
`app/routes/community-layout.tsx` owns their navigation and uses the site's
shared footer, including its About and community links.
Catalog CSS in `app/extensions.css` is scoped under `.extensions-site`; it
inherits the main site's theme and GNOME accent tokens. Appearance preferences
now persist across the guide and catalog on the same origin.

`app/data/extensions.json` contains reviewed listings. GNOME `metadata.json`
fields retain their upstream names; category, slug, dates, and display copy are
catalog fields, not a new extension format. `app/lib/extension-catalog.ts`
filters and sorts this local data using URL parameters. Compatibility is taken
from `metadata["shell-version"]`; no installs, ratings, or approval are implied.
Installation links point to verified GNOME listings when supplied, or to the
source repository's instructions. The site never executes extension code.

Submission, update, and removal issue forms live alongside the skill form in
`.github/ISSUE_TEMPLATE/` and target `vibe-gnome/website` through
`app/lib/extension-submissions.ts`. Maintainers review requests before editing
the catalog. Issues are not automatically published. The catalog's submission
link and each detail page's update/report links open the GitHub issue forms.

The community directory landing pages and known detail URLs are prerendered at
build time. Other routes continue to use `index.html` as the SPA fallback because `/`
is not included in the prerender list. No server runtime or new dependency is
required. Unknown extension paths show a not-found page with a catalog link.
