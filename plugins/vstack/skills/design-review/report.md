# Report

The report lets an owner decide what to build in minutes. It shows pictures first and words second, and the owner answers inside it.

## Before the report

The owner sees the start page first, at the same address the report will take.

- Serve `assets/review-start.html` unchanged. It shows the three levels, then the task list from the answers file.
- The page reloads into the report when `stage` becomes `report`.
- The page shows a `problem` above the task list when you set one.

## Start from the template

Copy `assets/report-template.html` and fill it. Do not write the page's CSS or script again. The template carries the shared vstack top bar, the tokens, the type scale, the decision controls and the comparison components.

- Edit only the content and the lines marked `FILL`.
- Keep the template's classes, ids and `data-` attributes. The script finds sections by them.
- Run `node plugins/vstack/lib/build-shell.mjs stamp` after a change to `lib/shell/`. The template carries the stamped shell.

## Page structure

Use these parts in this order. Leave out a part that has nothing in it.

1. **Header.** An eyebrow with the round and polish level, then the target's name as the title.
2. **Sections.** One per finding, grouped by category. See *Categories* below.

The script builds the rest from the sections: the numbers, the index, the slides and the closing box. Do not write them by hand.

If you find nothing to change, write no sections. The page says so and keeps the closing box.

Do not add metric tiles, counts, instructions, a verdict paragraph, a list of the top changes, a "what works" section or a footer. Say in chat what to protect and what you did not test.

## A section

Each section is a bar and a picture pair. It is about 20 words.

1. **Bar.** A title of six words or fewer in an `h2`. The template adds the number and Approve, Reject, Steer and Variations, in the same place on every section.
2. **Before and after.** Every section has a Today picture and a Proposed picture, side by side, each with a tag and at most one detail of six words or fewer.
3. **Nothing else.** Evidence, code locations and numbers go in the picture or in the chat reply. Put a code location in `data-loc` on the article if the build needs it.

A detail must not repeat the title. Do not add severity tags or before-and-after number pills.

## Categories

Group the sections under one heading per category, `<h2 class="area-title cat">`, with the heading in both languages.

- Name each category after the check that failed, with its ID, such as **C2 · Spacing** or **R8 · Loading, by action**. See `lenses.md`.
- In Showcase, name each category after the area it improves, such as First screen or Motion.
- Put the category that most harms use first, and the worst section first inside it.
- Leave out a category with no findings.

The index groups the sections the same way.

Make the Proposed picture from the real thing where you can: render the change in a copy of the product. Draw it in HTML with the product's tokens when you cannot. Say in chat what a drawing leaves out.

## Variations

Show two or more ways to fix one problem as variations of one section. Never give each way a section of its own.

- Put one Proposed figure in the `.cmp` for each variation.
- Give each one a `data-variant` name of one or two words, such as `data-variant="Band"`.
- Give it a Chinese name in `data-variant-zh`.
- Put your pick first.
- Mark a variation you added after **More variations** with `data-new`, and remove `data-new` from the earlier ones.

The template shows one variation at a time behind A, B, C tabs. Approve records the variation on show.

## Owner's calls

Mark **Owner's call** in the bar of any change to something the owner clearly chose, with `<span class="call"><span data-l="en">Owner's call</span><span data-l="zh">由你决定</span></span>` inside the `h2`. Add `data-yes="Keep" data-no="Change"` or similar when the section is a question, with `data-yes-zh` and `data-no-zh` beside them.

## Pictures

Every picture is a screenshot of the product, today or with the change rendered into it. Never put a list of changes, a description, a diagram of text or a code sample in a Today or Proposed picture. If a change cannot be shown, such as a rename in code, it is not a design review finding.

- Show the area at the size the owner will see it. Crop to the problem and do not shrink a full page into a thumbnail.
- Save screenshots with a tool that writes files, such as Playwright.
- Embed them as `data:` images, at most 1,200 px wide, as JPEG at quality 75.
- Draw a 2px red box over a Today picture with `.box` when the problem is one area. Give it `data-rect="x,y,width,height"` in the screenshot's own pixels. Measure it in the page you captured: the element's `getBoundingClientRect()`, less the capture's top-left corner, times the device scale factor. Never estimate a box by eye or place it with percentages.
- Show pictures at their full height. Add `fixed` to `.cmp` only when a crop to 16:10 loses nothing.
- The owner can open any picture at full size and flip between Today and Proposed. Nothing needs adding for it.
- Use `.wipe` for a draggable comparison only when both pictures have the same size.
- Show a chart, such as a strip of finding positions, when the finding is about spread or order.

## Two languages

The owner switches between English and 中文 in the page's settings. The page translates its own words. Write every word of yours twice, as a pair:

```html
<h2><span data-l="en">Phone titles cut to 7 letters</span><span data-l="zh">手机上标题只剩 7 个字</span></h2>
```

- Pair the eyebrow, category headings, titles, details and the `.call` label.
- Leave `Today` and `Proposed` in English. The page translates them.
- Write each language as a native speaker would. Do not translate word for word.
- The page opens in `lang` from the answers file, the language the owner picked in.

## How the owner answers

The owner presses Approve, Reject, Steer or Variations on each section. The page sends each answer when the owner moves to another section, and Send sends whatever is left, with the note about the whole review. A steer needs a note, written in the box that opens under the bar. A request for more variations takes an optional note in the same box. The box closes once the note is sent. The page saves every answer to the answers file, and the watcher reports `SENT`:

```json
{
  "decisions": {
    "f-tokens": { "choice": "approve" },
    "f-lanes": { "choice": "approve", "variant": "Band" },
    "f-size": { "choice": "reject" },
    "f-nav": { "choice": "steer", "note": "Keep the hint too." },
    "f-card": { "choice": "vary", "note": "Try a denser row." }
  },
  "overall": "Keep it short.",
  "revised": {}
}
```

| Key | Meaning |
|---|---|
| `decisions` | Every answer the owner has sent, by section id. A section with no entry is unanswered. `variant` names the approved variation. |
| `overall` | A note about the whole review. It belongs to this send only. |
| `revised` | Sections you changed after a steer, with the note each one answered. |
| `stage` | `choose`, `audit` or `report`. Written by you. A file without it is a report. |
| `level` | `clean`, `refined` or `showcase`. Written by the page when the owner picks, or by you when the level is already known. |
| `lang` | `en` or `zh`. The language the owner picked in. |
| `delivery` | `build` or `report`. Written by you as the default, and by the page with the owner's choice when they pick. |
| `canBuild` | `false` when the code is not in this repo. The page then offers only **Report only**. |
| `recommend` | `{"level", "reason": {"en", "zh"}}`. Your quick look at the site. The page marks that panel **Recommended**. |
| `mode` | The mode of each flow, such as `{"marketing site": "website", "sign-in": "web-app"}`. Written by you once you have picked. |
| `tasks` | The task list the start page shows, as `{"id", "text": {"en", "zh"}, "done"}`. |
| `problem` | One sentence, when you cannot finish the audit. The page shows it with a **Retry** button. |
| `retry` | `true` when the owner pressed **Retry**. Written by the page. Delete it when you try again. |

Keep every key you do not own when you write the file. The page does the same when it sends.

Revise a steered section, or add variations to a `vary` section, like this:

1. Change the section in the HTML page. Keep its id. For `vary`, keep the existing variations and add one to three new ones that follow the note.
2. Then write the answers file: delete the section from `decisions`, and set `revised["<id>"]` to the note it answered. For a `vary` with no note, use `"More variations"`.
3. Write the HTML first. The page offers the owner the new version as soon as the answers file changes.

The page then shows the section as **Revised**, quotes the note, and asks for a fresh answer. A steer you have not answered yet blurs its pictures and shows the owner that you are revising it. When you write the answers file, the page glows at the edges and offers the new version.

The page shows one section at a time, under its category heading. The owner moves with Previous and Next, the arrow keys or the index. Approve and Reject move on to the next section with no answer. The closing box is the last slide.

**Approve & finish**, under the ▾ beside Send, sends any answers left, then ends the review. The watcher reports `APPROVED` and the server closes. Build only what `decisions` approves, and only the variation it names. When `delivery` is `report`, write the report in Step 5 of `SKILL.md` in place of a build.

| Status | Meaning |
|---|---|
| Unanswered | Waiting for the owner. Not built. Ask about it unless the owner said to build it. |
| Approved | The owner said yes. Build it. |
| Rejected | The owner said no. Do not build it. |
| Steer | The owner asked for a change. Revise the proposal. |
| Variations | The owner asked for more variations. Add them to the section. |
| Revised | You changed it after a steer. It waits for a fresh answer. |
| Landed | Shipped as intended. Later rounds only. |
| Landed, broken | Shipped with a fault. List it first. Later rounds only. |
| Moved | The problem now sits somewhere else. Later rounds only. |

Opened off disk or as an Artifact, the page has no server. Send becomes **Copy decisions**, which copies the answers as text for the owner to paste into chat. To keep a record in that form, put `data-decision="approve"`, `"reject"` or `"steer"` on each settled section.

## Page requirements

- Give each section a stable id, so answers stay attached between versions.
- Keep the page self-contained. It must work served, opened off disk and inlined into an Artifact.
- Check the page at 1440, 834 and 390 px wide, in both themes, with no sideways scroll.
