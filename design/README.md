# design — the visual source for every page Visual Stack ships

This folder decides what the product looks like. `tokens.css` holds the palette,
type, spacing, shape and elevation scales; `design-guide.html` shows them
rendered, and is the page to open when deciding whether a change reads as the
same product.

Everything Visual Stack ships is a page: the review workspace, the story map,
the spec tree, the build board, the chooser. They are the screens this guide
governs. There is no separate application.

## How the tokens reach the pages

A page never links this folder. Every page has to work three ways — served over
http, opened off disk, and inlined into an Artifact under a CSP that blocks all
external requests — so nothing is fetched at runtime.

1. `tokens.css` is the source: the primitive scales, and the role each one fills.
2. `plugins/vstack/lib/shell/tokens.css` carries those values as the roles pages
   actually consume — `--surface`, `--ink`, `--brand`, `--line`.
3. `plugins/vstack/lib/build-shell.mjs stamp` copies the shell into every page
   between its `vstack:shell` markers.

So a colour changes here, and reaches the product on the next stamp. Run
`build-shell.mjs check` to find a page that has drifted.

## Rules that come from the pages, not from the guide

- **Roles, not colours.** A page asks for `--surface`, never for white. That is
  what lets one stylesheet serve light and dark.
- **Both themes are first-class.** Every page supports the OS preference and an
  explicit choice. A value added for light needs its dark counterpart in the
  same change.
- **System fonts only.** The type scale is honoured; the families are not. A
  webfont is an external request, which an Artifact's CSP blocks and a file on
  disk cannot make, and embedding faces would land in every stamped page.
- **Page-specific hues stay in the page.** The story map's phase bands, the
  board's new/have/touch, the spec's priorities mean something only there. This
  folder holds what is shared.

## Where the rest of the rules live

- Working on the pages, the stamped shell and the build: the root
  [`CLAUDE.md`](../CLAUDE.md) → *Self-contained pages and the stamped shell*.
- Changing an existing screen: root `CLAUDE.md` → *UI tweaks and composition
  reuse*.
- Working in this folder: [`CLAUDE.md`](CLAUDE.md).
