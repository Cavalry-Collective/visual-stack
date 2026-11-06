# Report

Write for an owner who will decide what to build from this page. Use short sentences and specific numbers.

## Page structure

Use these sections in this order, and leave out any with no findings. Group findings by the product's own areas, using the product's own words for them.

1. **Header.** What was reviewed, the date, the polish level, and the build or commit.
2. **Verdict.**
   - Up to four tiles, each with an area, a one-word rating and one line of evidence.
   - One or two paragraphs naming the central problem. Include what is already strong.
   - The changes that matter most, in order, up to ten.
3. **Findings by area.** Start with the main object, such as a card or row, if the review covers one.
4. **States and phone.** Only those the requirements call for.
5. **Motion.** At Refined and Showcase, a table of interaction, today and proposed.
6. **Code health.** Only what would block the polish.
7. **Plan.** See below.
8. **Footer.** What you did not exercise, and why.

## Finding format

Each finding has a severity, a title, a location, the evidence, a visual and the change.

```
P1  The title does not lead
Card.tsx · .title 12.5px/500

Title is 12.5px, weight 500. The category chip is 10.5px semibold in colour with
a tinted fill, and the date pill is filled red. In every screenshot the coloured
elements are read first.

[Before and after comparison]

Refinement
- Title 13.5px, weight 600, two-line clamp, full ink.
- Metadata row 11.5px in --ink-3; category as text with a 6px swatch.
- Mono dates only when late or within 3 days.
```

Severity:

| Tag | Meaning |
|---|---|
| P0 | Broken now and blocks use. Fix it on its own, ahead of the plan. |
| P1 | Harms use or trust on a main screen. Build in the first slices. |
| P2 | Visible inconsistency or friction. Build in the plan. |
| P3 | Small refinement. Group several under one heading. |

Add **Owner's call** to any finding that changes something the owner clearly chose. Later rounds also use **Landed** for work that shipped as intended.

## Visuals

Every finding about something visible gets one of these:

- **Before and after comparison.** Use this when the fix changes how something looks. Show the current version beside the proposed one. Draw the proposed version in HTML with the product's own token values and real content. Keep every fact the current version shows, or name what you removed.
- **Screenshot with a red box.** Use this to point at a problem, or when a comparison would add nothing. Measure the element's position in the page, then draw a 2px red box over the screenshot in HTML, so the box stays sharp and the owner can comment on it.

Save screenshots with a tool that writes files, such as Playwright. Embed them as compressed `data:` images, because the page must be self-contained. If you cannot save a screenshot, redraw the area in HTML.

## Plan

- Order the slices so each one makes the next easier. Consolidation work goes first if polish depends on it.
- Size each slice as one spec. It must ship alone and be visible the day it lands.
- Name each slice for its outcome, such as "Quiet the card".
- List the changes under each slice, and list **Owner's call** items separately.

## Page requirements

- Meet the requirements the workspace places on the file, listed in §2 of `../review/SKILL.md`.
- Give each finding a stable id, so comments stay attached between versions.
