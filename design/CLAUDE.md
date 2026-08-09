# UI prototypes

Rules for creating and iterating **UI prototypes in this folder only** — they do not govern app development (`apps/*` has its own `CLAUDE.md` files). The requirements spec under `specs/` is the source of truth for what to build; these rules govern how.

## Deliverable contract

- **One prototype = one self-contained HTML file.** Plain HTML, CSS, and JavaScript only — no frameworks, build step, package manager, or external requests. Everything (styles, scripts, data, icons) is inlined; the file opens from disk and works.
- **No backend.** All data is an in-file fake dataset; all behaviour is simulated client-side. Simulated latency is fine where it makes a loading state reviewable.
- **Fully interactive, honestly.** Navigation, forms, filters, dialogs, menus, sorting, and other controls the spec implies actually work against the fake data. A control that can't act is absent — never a dead button or fake link.
- **No tests.** No test code, harnesses, or app mechanics (persistence, auth, routing infrastructure). Effort goes into the experience, not engineering.

## Visual source

`tokens.css` + `design-guide.html` are the visual keystone. Use the semantic tokens (colour, type, spacing, radius) so every prototype looks like the same product. If a needed value is missing, extend the token scale — never hard-code per screen.

## What to cover

- **The main user journeys** in the spec, end to end — a reviewer should be able to *do* the tasks, not just look at screens.
- **Every relevant state**: loading, empty, success, error, validation, disabled, and permission-restricted where roles exist. Make states reachable through the UI itself (or an unobtrusive demo switch if they can't be triggered naturally).
- **Representative edge cases**: long names, large counts, zero results, partial data — chosen from what the domain will really produce.

## Principles

1. **Follow the spec; exercise judgement in its gaps.** Where the spec is silent, follow the patterns of established products in the domain — users already know them. Divergence needs a defensible improvement.
2. **Start lean, iterate to polished.** First pass covers the journeys plainly; refinement comes through review rounds. Exception: patterns that are table-stakes in the domain ship complete from day one.
3. **Tables are the enterprise workhorse.** Growing collections get real datagrids — search, sort, column filters, pagination — not cards or simple lists.
4. **Order by attention, place by belonging.** What the user acts on comes first; metrics last. Every control lives on the object it conceptually belongs to.
5. **Disclose progressively.** Big forms become steps; records lead with the most-used details, rest behind tabs — but don't hide what fits.
6. **Realistic, causally consistent data.** Credible scale, honest metrics: undefined is an em dash, never a fake zero. Numbers that should add up, do.
7. **Sweat the details.** Alignment, centred glyphs, conventional icons, live feedback during direct manipulation. Polished enough that stakeholders discuss the product, not the prototype.

## Anti-patterns (remove on sight)

Commentary copy (subtitles, explainer banners, self-narrating UI) · elements that don't earn their place · redundant marks (same fact twice) · dead or misleading controls · bold on data values (weight marks identity; colour marks state) · wrapping toolbars (overflow into …) · scrolling content inside a modal (the modal scrolls whole) · non-standard icons · desktop layouts compressed into phone widths.
