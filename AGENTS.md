# AGENTS.md

This document defines how AI agents work in the Vibe GNOME repository.

## Project structure

- `app/`: React Router source, routes, styles, and shared browser logic.
- `public/`: static assets copied directly into the build.
- `tests/`: deterministic Bun tests.
- `docs/design/`: architecture and visual design decisions.
- `docs/implementation/`: setup and implementation notes.
- `docs/reference/`: curated external references.
- `docs/user/`: end-user documentation.
- `scripts/`: repeatable project automation.
- `examples/`: copy-ready examples from the guide.
- `postmortem/`: incident reports and retrospectives.
- `website/`: original supplied brand asset; `public/logo.svg` is its deployable copy.

Preserve this structure. New application code belongs in `app/`, and new tests
belong in `tests/`.

## Development workflow

1. Read the relevant files in `docs/design/` and `docs/implementation/`.
2. Implement small, readable React and TypeScript modules in `app/`.
3. Add or update deterministic tests in `tests/`.
4. Update documentation when architecture, behavior, or workflows change.
5. Run `bun run check` before handing work back.

## Commands

- `bun install`: install exact dependencies from `bun.lock`.
- `bun run dev`: run the local React Router development server.
- `bun run build`: create the static production build.
- `bun run preview`: preview the production build.
- `bun run test`: run Bun tests.
- `bun run typecheck`: generate route types and run TypeScript.
- `bun run lint`: check formatting and lint rules with Biome.
- `bun run check`: run lint, typecheck, and tests.

## Coding and design rules

- Keep components focused and browser preference logic in `app/lib/`.
- Prefer semantic HTML and native controls before adding component libraries.
- Preserve visible keyboard focus, reduced-motion support, responsive layouts,
  and accessible labels.
- Keep light, dark, system, and all supported GNOME accent choices working.
- Do not add a framework or dependency without documenting why it is needed.
- Avoid duplicate content; shared copy such as agent prompts belongs in one module.

## Documentation and testing

Architecture changes go in `docs/design/`, setup changes in
`docs/implementation/`, and user-facing instructions in `docs/user/`. New
workflows require a runnable or copy-ready example in `examples/`.

Tests must not depend on external services. When browser-only behavior cannot be
unit tested, verify it in the local preview at desktop and mobile widths.

## Safety

Do not remove supplied assets or large sections of code without a clear reason.
Preserve unrelated user changes. Prefer `git` for version-control operations.
