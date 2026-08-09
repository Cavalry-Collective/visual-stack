# Working in design/

Rules for changing the visual source. What it is and how it reaches the pages is
in [`README.md`](README.md).

## The token source

- **One source.** `tokens.css` owns the palette, type, space, shape and
  elevation scales. `plugins/vstack/lib/shell/tokens.css` carries the same
  values as the roles pages consume. Change this file, then the shell, then run
  `node plugins/vstack/lib/build-shell.mjs stamp` — all in the same commit.
- **Extend the scale, never the screen.** A page that needs a value which is not
  here gets a new step here. Hard-coding a colour in a page is how two greys
  that should have been one end up on the same screen.
- **Three tiers.** Primitives are raw scales and are where a rebrand happens.
  Semantic roles name what a value is for, and are what everything else reads.
  Component overrides exist only where a component genuinely differs.
- **Every colour role is defined for light and dark.** A page renders in both,
  and a role that exists in one is a hole in the other.

## The guide

- `design-guide.html` is the page to open when judging whether a change still
  reads as one product. Keep it showing what the tokens currently are, not what
  they were.
- It is a page like any other Visual Stack ships: self-contained, no build step,
  no external requests, works opened off disk.

## What this folder does not decide

- **Behaviour.** How the review loop works is `plugins/vstack/contracts/`.
- **Page structure.** The shared top bar, scrubber and their scripts are
  `plugins/vstack/lib/shell/`, stamped into pages rather than linked.
- **Anything host-specific.** A product name reaches a page as data from a Host
  profile, never as a value here.
