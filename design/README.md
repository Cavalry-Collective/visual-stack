# design — UI prototype / design reference

**Reference only — not part of the buildable workspace.** Prototypes live here and
are the source for visual design, screen inventory, copy, and flows. **Do not copy
the prototype code** into the apps (its structure is a single-file simulation, not
the app stack). See the *UI mockup / design reference* section in the root `CLAUDE.md`.

This folder also holds the **design guide** — `design-guide.html` + `tokens.css`,
the visual keystone confirmed before any UI work (`apps/frontend/CLAUDE.md` →
*Design guide*) — and **`CLAUDE.md`**, the rules for creating the prototypes
(prototype work only, not app development). Everything below concerns the prototypes.

The guide ships as foundations and is **hydrated per project**: reconciled with the
chosen UI component approach, then populated with that project's own component
specimens as they are built (`apps/frontend/CLAUDE.md` → *Hydrating the design guide*).

## Layout

Keep prototypes findable so "point the relevant prototype at the spec" is mechanical, not a hunt.

- **One prototype = one self-contained HTML file per feature** (see `CLAUDE.md` → *Deliverable contract*), named by the feature's semantic name — never by tool export names like `screen-3-final-v2`. A prototype's screens are navigated inside the file.
- **Inventory table (below) is the index — keep it current** as screens are added. Columns: **screen** (semantic name) · **prototype file** · **owning spec**. Several screens may point at the same prototype file. The *screen* name must match its name in the central route registry (`apps/frontend/CLAUDE.md`), so a screen, its prototype, and its URL cross-reference through the registry — which stays the **only** route→URL surface (the frontend file forbids a second list, so this table carries no route column).
- **Flows** are shown by the prototype's own navigation — don't mandate separate flow diagrams.

| Screen | Prototype file | Owning spec |
|---|---|---|
| _(example) dashboard_ | `dashboard.html` | `specs/2026-01-01-dashboard.md` |

## Building from a prototype

A screen's **initial build** is verified against its design reference — never declared done from reading the code. Prototypes guide that first build only: once a screen is iterated and improved it drifts from the prototype by design, so **later changes are verified against the running app, not re-checked against the prototype**.

- **With a prototype — verify, don't assume.** After first building a screen that has a prototype, run the app and view the built screen at the project's declared primary form factor plus the responsive baseline's other end (e.g. mobile + desktop), compare against the prototype, and iterate until layout, spacing, visual hierarchy, and copy match. **Capture and actually look at the rendered output** (a screenshot or equivalent) — don't reason about the code and declare it done. This is the success marker for the screen's **initial build** (ties to root `CLAUDE.md` *Goal-driven execution*). The capture/visual-diff tool is a per-project choice; the view-and-compare-against-reference step is mandatory regardless of tool.
- **Without a prototype — don't invent silently.** For a non-trivial **new** screen with no prototype, sketch the screens/copy/flow in the feature's spec under `specs/` and get it approved there before building — reuse the existing spec gate, don't create a second approval process. For minor changes to an existing screen, build to the conventions in `apps/frontend/CLAUDE.md` and note in the PR that it was "built to convention, no prototype." Never improvise UI for a non-trivial new screen with no reference.
