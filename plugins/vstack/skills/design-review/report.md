# Report

The report lets an owner decide what to build in minutes. It shows pictures first and words second, and the owner answers inside it.

## Start from the template

Copy `assets/report-template.html` and fill it. Do not write the page's CSS or script again. The template carries the tokens, the type scale, the decision controls and the comparison components.

- Edit only the content and the lines marked `FILL`.
- Keep the template's classes and `data-` attributes. The script finds sections by them.
- Run `node plugins/vstack/lib/build-shell.mjs stamp` after a palette change. The template takes the tokens block.

## Page structure

Use these parts in this order. Leave out a part that has nothing in it.

1. **Header.** Round, date, polish level, build or commit, then the title.
2. **Decision panel.** Counts by severity, the owner's running tally, and the actions Send decisions, Approve the rest and Approve & finish. The template supplies it.
3. **Index.** One link per section, worst first, each with its severity. The links take the owner's decision as a colour.
4. **Sections.** One per finding, worst first. See below.
5. **Plan.** Slices as rows. Each slice lists its findings as chips that link to them and take their status. Draw "I would stop here" between the last slice you recommend and the rest. Repeat the decision panel after the slices.
6. **Footer.** One line on what you did not exercise, and why.

Do not add metric tiles, a verdict paragraph, a list of the top changes or a "what works" section. The index replaces the first two. Say in chat what to protect.

## A section

Each section is a bar and a picture pair. It is about 20 words.

1. **Bar.** Severity, a title of six words or fewer, and an optional delta such as `10.2 → 12.7 px`. The template adds Approve, Reject and Steer to it, in the same place on every section.
2. **Before and after.** Every section has a Today picture and a Proposed picture, side by side, each with a tag and at most one short detail.
3. **Nothing else.** Evidence, code locations and numbers go in the delta, in the picture, or in the chat reply. Put a code location in `data-loc` on the article if the build needs it.

Make the Proposed picture from the real thing where you can: render the change in a copy of the product. Draw it in HTML with the product's tokens when you cannot. Name what a drawing leaves out in the footer.

Mark **Owner's call** in the bar of any change to something the owner clearly chose. Add `data-yes="Keep" data-no="Change"` or similar when the section is a question.

## Pictures

- Show the area at the size the owner will see it. Crop to the problem and do not shrink a full page into a thumbnail.
- Save screenshots with a tool that writes files, such as Playwright.
- Embed them as `data:` images, at most 1,200 px wide, as JPEG at quality 75.
- Draw a 2px red box over a Today picture with `.box` when the problem is one area.
- Use `.wipe` for a draggable comparison only when both pictures have the same size.
- Show a chart, such as a strip of finding positions, when the finding is about spread or order.

## Severity

| Tag | Meaning |
|---|---|
| P0 | Broken now and blocks use. Fix it on its own, ahead of the plan. |
| P1 | Harms use or trust on a main screen. Build in the first slices. |
| P2 | Visible inconsistency or friction. Build in the plan. |
| P3 | Small refinement. Build last. |

Colour carries urgency. P0 is filled red, P1 is a red tint, P2 is outlined and P3 is plain text.

## How the owner answers

The owner presses Approve, Reject or Steer on each section, then Send decisions. The page sends one general comment per send. It reads like this:

```
Decisions from the report.
Approved: f-tokens (One template for every run)
Rejected: f-size (Smaller images)
Steer f-nav (Links in Annotate mode): Keep the hint too.
Steer the whole report: Keep it short.
Undecided: f-zoom, f-decide
```

Approve & finish sends the same comment, then ends the review.

| Status | Meaning |
|---|---|
| Proposed | Waiting for the owner. Shows no label. |
| Owner's call | Changes something the owner chose. Needs a yes. |
| Approved | The owner said yes, or pressed Approve the rest. |
| Rejected | The owner said no. Do not build it. |
| Steer | The owner asked for a change. Change the proposal and publish it again. |
| Landed | Shipped as intended. Later rounds only. |
| Landed, broken | Shipped with a fault. List it first. Later rounds only. |
| Moved | The problem now sits somewhere else. Later rounds only. |

- Undecided sections are not built. Ask the owner about them, unless the owner said that approving builds them.
- When you publish the next version, add `data-decision="approve"`, `"reject"` or `"steer"` to each section the owner settled. The page then shows it as a status.
- Put the earlier statuses back on the sections of a later round, and add the statuses Landed, Landed broken and Moved to the bar's label row.

## Plan

- Order the slices so each one makes the next easier. Consolidation work goes first if polish depends on it.
- Size each slice as one spec. It must ship alone and be visible the day it lands.
- Name each slice for its outcome, such as "Quiet the card".
- List Owner's calls as their own sections, so the owner answers them with the same controls.

## Page requirements

- Meet the requirements the workspace places on the file, listed in §2 of `../review/SKILL.md`.
- Give each section a stable id, so decisions and comments stay attached between versions.
- Keep every control inside an element marked `data-vstack-control`. The workspace lets a press on it reach the page in Annotate mode.
- Check the page at 1440, 834 and 390 px wide, in both themes, with no sideways scroll.
