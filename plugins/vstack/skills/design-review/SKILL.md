---
name: design-review
description: Audit the UI and UX of what we are working on at a chosen level of polish, open the proposed changes as a report the owner answers in their browser, then build what the owner approves. Product code stays untouched until approval. The report's words and new UI copy go to ChatGPT through vstack:proofread where the host supports it. Use when the user invokes /vstack:design-review or $vstack:design-review, asks for a design review, design audit, UI or UX review, or another review round, or wants a screen or app to look more polished, premium or consistent, even if they do not say "review". To comment on a wireframe, page or running app with no audit, use vstack:review.
---

# Design Review

Audit first, propose second, build after the owner approves. The owner answers the proposal in a report page, in their own browser tab, before any product code changes.

Read `lenses.md` before Step 3 and `report.md` before Step 4. Both sit beside this file.

## Host

Follow §0 of `../review/SKILL.md` to load the adapter for your host. This skill uses the Host ops `run`, `edit`, `background`, `watch_stream`, `stop` and `browser_capture`, defined in `contracts/host.md`.

## Step 1: Set the scope and open the review

The skill runs inside a conversation, so take the target and any focus areas from the current work. Ask only if the conversation leaves the target unclear.

The owner picks the level of polish in the review page, not in chat:

| Level | 中文 | Aim |
|---|---|---|
|---|---|
| **Clean** | 简洁 | Consistent and easy to use. Clear hierarchy, spacing and type, every state handled, and the design system followed. No new effects. |
| **Refined** | 精致 | Clean, plus a premium feel. Considered depth, small interactions, and a transition on every state change. |
| **Showcase** | 惊艳 | Refined, plus thoughtful animation, special effects and moments of delight. |

The level decides which lenses apply and how far each proposal goes. Do not propose effects above the chosen level.

If `.vstack/local/design-review/` holds an earlier round for this target, also follow **Later rounds** below.

Open the review before you audit:

1. Write the answers file, `.vstack/local/design-review/<target>-round-<n>.json` from the project root:

   ```json
   {"stage": "choose", "decisions": {}, "overall": "", "revised": {}}
   ```

   If the owner already named a level in chat, or this is a later round, write `"stage": "audit"` and `"level"` instead. The page then skips the choice.
2. Copy `assets/review-start.html` to `<target>-round-<n>.html`, unchanged.
3. Serve the page with Host op `background`. It opens in the owner's browser:

   ```bash
   LIB=<this skill dir>/../../lib
   R=.vstack/local/design-review/<target>-round-<n>
   node "$LIB/json-bridge.mjs" serve --json "$R.json" --template "$R.html" --tool design-review --port 0
   ```

   Give the owner the whole URL it prints, because the token is part of it.
4. Arm the watcher with Host op `watch_stream`, passing the seq the server printed:

   ```bash
   node "$LIB/json-bridge.mjs" watch --json "$R.json" --stream --tool design-review --seq <seq>
   ```

   How the link behaves is in [`contracts/bridge-loop.md`](../../contracts/bridge-loop.md).
5. Ask the owner to pick a level in the page, then wait for `SENT`. Do not start Step 2 until the answers file holds a `level`.

The pick also saves `lang`, `en` or `zh`: the language the page showed when the owner picked.

### Show progress

Keep the page current while you work through Steps 2 to 4:

1. Once the level is known, add `tasks` to the answers file and set `stage` to `audit`. Keep every other key. Write four to seven tasks, each in both languages:

   ```json
   {"id": "capture", "text": {"en": "Capture the screens", "zh": "截取各个页面"}, "done": false}
   ```

2. Tick each task as you finish it:

   ```bash
   node "$LIB/json-bridge.mjs" patch --json "$R.json" --id capture --set done=true
   ```

3. If you cannot finish, set `problem` to one sentence in the owner's language and say the same in chat.

## Step 2: Read the current instructions

Read the project instructions and anything design-related: the design guide, frontend contract, token file and stylesheets. Then read the code for the screens in scope. The review must fit the rules the project already has.

## Step 3: Look at the work

Open whatever we are working on, whether that is a dev server, a preview or a live site, with `browser_capture`. Choose the screen sizes, themes and states from the requirements.

If the adapter says `browser_capture` is not available, ask the owner for screenshots of each screen and take sizes from the stylesheets. Say in chat what you could not measure.

Collect evidence:

- Screenshot each screen, and save the images a finding will need.
- Measure with JavaScript in the page: `scrollWidth` against `clientWidth`, heights, counts, font sizes, contrast. Use numbers in findings, because "33 cards, 4,312px" can be acted on and "feels heavy" cannot.
- Stress the layout with the longest title, the largest list and an empty list. Check for sideways overflow.
- Read the console for errors, where the host's browser tools can reach it.

## Step 4: Write the review

1. Write the findings with the lenses for the chosen level:
   - Name the weakness, with its evidence and its location in the code.
   - Propose a concrete change with values, such as "13.5px, weight 600, two-line clamp".
   - Show every finding as a before and after pair of screenshots of the product, with one short title. See *Pictures* in `report.md`.
   - Report one finding per kind of defect.
   - Show two or more ways to fix one problem as variations of one section. See *Variations* in `report.md`.
   - Mark **Owner's call** on any change to something the owner clearly chose. Offer a way to keep the idea.
2. Build the review as one self-contained HTML page. Copy `assets/report-template.html` and fill it, in the format in `report.md`. Save it over the start page at `$R.html`.
   - Write every word in English and in Chinese. See *Two languages* in `report.md`.
   - Cut every word a picture already says. A title, a delta and one detail per picture are the whole text.
   - Run `vstack:proofread` on the report's words in both languages: titles, details and slice names. Read `../proofread/SKILL.md` and follow it, then put the improved words back in the page.
3. Set `stage` to `report` in the answers file. Keep every other key. Write the HTML first: the open tab reloads into the report as soon as `stage` changes.
4. Reply in chat with the verdict, the top changes, what already works and what you did not test. Keep the reply short.

Product code stays unchanged until the owner chooses **Approve & finish** or says to build.

Answer each watcher event:

| Event | Action |
|---|---|
| `SENT`, while `stage` is `choose` | The owner picked. Read `level` and `lang`, start *Show progress*, and continue at Step 2. |
| `SENT` | Read the answers file. Revise every steered section and add variations to every `vary` section, as in *How the owner answers* in `report.md`. Do not build anything yet. |
| `APPROVED` | Build the approved sections, in Step 5. |
| `CLOSED` | Say the link is closed. The answers file keeps the last send. If it closes during the audit, finish the report, then serve the page and arm the watcher again. |

Do not build a Rejected, a steered, a `vary` or an unanswered section.

## Step 5: Build

Build what the owner approved, one slice at a time.

- Follow the target repo's own workflow for specs, branches, tests and release.
- After the tests pass, look at the slice in a browser with long content and real-sized data.
- Run `vstack:proofread` on any new UI copy, by reading `../proofread/SKILL.md` and following it. Running design-review counts as the request that skill requires, for UI copy and the report's words.
- If proofread stops, do not send the copy. It stops on secrets, credentials or personal data, on a host without `user_browser`, and on a browser that is not connected or not signed in. Tell the owner why it stopped and continue the build.
- Report after each slice: what changed, how you verified it, and what you left out.
- Ask first if a change alters what a screen is for. Moving a type of item off the main board is one example.

## Later rounds

A later round reviews the result of the last plan. Earlier fixes can create new problems or move an old one elsewhere. Read the last round's page, and save this round under the next number.

- Reuse the last round's level, unless the owner asks for another.
- Mark each earlier area **Landed**, **Landed, broken** or **Moved**.
- List bugs the slices introduced first. Fix a bug that blocks use in its own small change.
- Look for what the fixes made louder.
- Carry forward items left out of the last plan.
- End with one plan, and say where you would stop polishing.

## Notes

- **Browser pass.** Tests miss layout faults. In the first run, visual passes caught overflowing tabs and hidden filter chips. A long title that made the panel scroll sideways shipped because no test used one.
- **Louder after a fix.** In the first run, removing the empty grey cells left one 4,312px column as the heaviest thing on the board.
