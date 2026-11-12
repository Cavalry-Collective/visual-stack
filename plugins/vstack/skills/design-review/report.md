# Report

The report lets an owner decide what to build in minutes. It shows pictures first and words second, and the owner answers inside it.

## Start from the template

Copy `assets/report-template.html` and fill it. Do not write the page's CSS or script again. The template carries the shared vstack top bar, the tokens, the type scale, the decision controls and the comparison components.

- Edit only the content and the lines marked `FILL`.
- Keep the template's classes, ids and `data-` attributes. The script finds sections by them.
- Run `node plugins/vstack/lib/build-shell.mjs stamp` after a change to `lib/shell/`. The template carries the stamped shell.

## Page structure

Use these parts in this order. Leave out a part that has nothing in it.

1. **Header.** An eyebrow with the round and polish level, the target's name as the title, then the date and the build or commit.
2. **Sections.** One per finding, worst first. See below.
3. **Plan.** Slices as rows. Each slice lists its findings as chips that link to them and take their status. Draw "I would stop here" between the last slice you recommend and the rest.
4. **Footer.** One line on what you did not exercise, and why.

The script builds the rest from the sections: the numbers, the index, the counts by severity, the progress in the top bar and the closing box. Do not write them by hand.

Do not add metric tiles, a verdict paragraph, a list of the top changes or a "what works" section. Say in chat what to protect.

## A section

Each section is a bar and a picture pair. It is about 20 words.

1. **Bar.** Severity, a title of six words or fewer in an `h2`, and an optional delta such as `10.2 → 12.7 px`. The template adds the number and Approve, Reject and Steer, in the same place on every section.
2. **Before and after.** Every section has a Today picture and a Proposed picture, side by side, each with a tag and at most one short detail.
3. **Nothing else.** Evidence, code locations and numbers go in the delta, in the picture, or in the chat reply. Put a code location in `data-loc` on the article if the build needs it.

Make the Proposed picture from the real thing where you can: render the change in a copy of the product. Draw it in HTML with the product's tokens when you cannot. Name what a drawing leaves out in the footer.

Mark **Owner's call** in the bar of any change to something the owner clearly chose, with `<span class="call">Owner's call</span>` inside the `h2`. Add `data-yes="Keep" data-no="Change"` or similar when the section is a question.

## Pictures

- Show the area at the size the owner will see it. Crop to the problem and do not shrink a full page into a thumbnail.
- Save screenshots with a tool that writes files, such as Playwright.
- Embed them as `data:` images, at most 1,200 px wide, as JPEG at quality 75.
- Draw a 2px red box over a Today picture with `.box` when the problem is one area.
- Show pictures at their full height. Add `fixed` to `.cmp` only when a crop to 16:10 loses nothing.
- The owner can open any picture at full size and flip between Today and Proposed. Nothing needs adding for it.
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

The owner presses Approve, Reject or Steer on each section, then Send. A steer needs a note, written in the box that opens under the bar. The page saves every answer to the answers file, and the watcher reports `SENT`:

```json
{
  "decisions": {
    "f-tokens": { "choice": "approve" },
    "f-size": { "choice": "reject" },
    "f-nav": { "choice": "steer", "note": "Keep the hint too." }
  },
  "overall": "Keep it short.",
  "revised": {}
}
```

| Key | Meaning |
|---|---|
| `decisions` | Every answer the owner has sent, by section id. A section with no entry is unanswered. |
| `overall` | A note about the whole review. It belongs to this send only. |
| `revised` | Sections you changed after a steer, with the note each one answered. |

Revise a steered section like this:

1. Change the section in the HTML page. Keep its id.
2. Then write the answers file: delete the section from `decisions`, and set `revised["<id>"]` to the note it answered.
3. Write the HTML first. The page offers the owner the new version as soon as the answers file changes.

The page then shows the section as **Revised**, quotes the note, and asks for a fresh answer. A steer you have not answered yet shows the owner that you are revising it.

**Approve & finish**, under the ▾ beside Send, sends any answers left, then ends the review. The watcher reports `APPROVED` and the server closes. Build only what `decisions` approves.

| Status | Meaning |
|---|---|
| Unanswered | Waiting for the owner. Not built. Ask about it unless the owner said to build it. |
| Approved | The owner said yes. Build it. |
| Rejected | The owner said no. Do not build it. |
| Steer | The owner asked for a change. Revise the proposal. |
| Revised | You changed it after a steer. It waits for a fresh answer. |
| Landed | Shipped as intended. Later rounds only. |
| Landed, broken | Shipped with a fault. List it first. Later rounds only. |
| Moved | The problem now sits somewhere else. Later rounds only. |

Opened off disk or as an Artifact, the page has no server. Send becomes **Copy decisions**, which copies the answers as text for the owner to paste into chat. To keep a record in that form, put `data-decision="approve"`, `"reject"` or `"steer"` on each settled section.

## Plan

- Order the slices so each one makes the next easier. Consolidation work goes first if polish depends on it.
- Size each slice as one spec. It must ship alone and be visible the day it lands.
- Name each slice for its outcome, such as "Quiet the card".
- List Owner's calls as their own sections, so the owner answers them with the same controls.

## Page requirements

- Give each section a stable id, so answers stay attached between versions.
- Keep the page self-contained. It must work served, opened off disk and inlined into an Artifact.
- Check the page at 1440, 834 and 390 px wide, in both themes, with no sideways scroll.
