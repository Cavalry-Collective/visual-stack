---
name: polish-indepth
description: Experimental in-depth mode for Visual Stack Polish. Maps a whole site or web app into its pages, modals, popups and slide-in panels, and into the workflows people come to finish. Reviews every screen and every workflow the owner leaves switched on, each with its own agent, and merges the findings into one Polish report. Read by vstack:polish when the owner turns on In depth; not a skill of its own.
---

# Polish in depth (experimental)

A normal Polish round audits a product in one pass. On a whole site or a large web app, that pass reaches a few screens and returns few findings. In-depth mode maps the product first and gives each part its own agent, in two modes:

| Mode | Asks | Each agent |
|---|---|---|
| **Screens** | Is each screen right? | Reviews one screen against the level's checks. |
| **Workflows** | Can people finish what they came to do? | Walks one journey from where it starts to where it should end, and finds the step where people drop out. |

The owner picks Pages, Workflows or Both on the start page, right after the level, and the map covers only that. Every page in the run shows the same rail of steps: Level, Cover, Map, Review and Report.

Polish reads this file when the answers file's `indepth` is `"pages"`, `"workflows"` or `"both"`. `true`, written when the owner asks in chat, means `"both"`. Follow `../../skills/polish/SKILL.md` as usual, with these changes:

| Polish step | In depth |
|---|---|
| Step 1 and Step 2 | Unchanged. |
| Step 3 | Replaced by Steps A to C below. |
| Step 4 | Starts with Step D below, then continues at item 2, *Build the review*. |
| Step 5 and later rounds | Unchanged, except *Later rounds* below. |

`$R`, `$LIB`, the watcher and *Show progress* are Polish's. Keep serving the page and answering watcher events yourself while subagents work.

## Step A: Build the site map

Show progress while you map, as in *Show progress* in Polish. Name the tasks after the work, such as "Read the routes", "Walk the navigation", "Open popups and panels" and "Find the workflows".

Map only what `indepth` covers, so the owner waits less:

| `indepth` | Map |
|---|---|
| `pages` | The pages and what opens on them. Skip *Find the workflows*. |
| `workflows` | The workflows, and only the screens their steps pass through. |
| `both` | Everything below. |

### Find the pages

1. If the code is in this repo, read the router first: file-based routes, a route table or a sitemap generator. It is the most complete list.
2. On a live site, read `/robots.txt` and the sitemaps it names, or `/sitemap.xml`.
3. Walk the product. Open the target with `browser_capture`, evaluate `assets/survey.js` in the tab, and follow the `links` it returns, breadth first.
4. Stop at three links from the start or 200 pages, whichever comes first. Say in chat where you stopped.
5. Group pages that share one layout into one screen, such as blog posts or product pages. Give it `count`. Check only one of them, the one with the longest content. The map says so on the screen's row.
6. Leave out a page that fails to load. List each one, with its status, in the chat reply.

### Find what opens on each page

1. Read `triggers` and `overlays` from `survey.js` on every page you keep.
2. Open each trigger whose `submits` is `false`. Record what opens, then close it with Escape or its close button.
3. Also open the menu at phone width, any cookie or consent banner, and any toast a safe action shows.
4. Never open a trigger that submits, pays, deletes, signs out or sends a message. On a site you do not own, never submit a form or pay.
5. Record an overlay that appears on many pages, such as the site menu, once, under the first page that shows it.

If the target asks for a sign-in, follow Step 3 of Polish.

### Find the workflows

A workflow is a journey someone comes to finish, such as signing up, buying, booking, getting in touch or finding an answer.

1. Start from what the product asks people to do: the main calls to action, the navigation, and every form in `survey.js`'s `forms`.
2. Name each journey after its outcome, in the visitor's words, such as "Buy a shirt" or "Get in touch".
3. List its steps as screens on the map, from where people start to where the outcome shows.
4. Keep the journeys that matter most to the product, usually three to eight.
5. On a content site with no forms, the journeys are about finding things, such as "Find the download" or "Read the guide".

### Write the map

1. Take a preview of every screen while you map it: a screenshot at desktop size, with any overlay open, 400 px wide, as a JPEG at quality 60. Put it in the screen's `shot` as a `data:` URL. The map shows it in the preview beside the map when the pointer rests on the screen's row or on a workflow step, and inside the row on a phone.
2. Copy `assets/site-map.html` over `$R.html`.
3. Write `sitemap` to the answers file, and set `stage` to `map`. Keep every other key. The open tab reloads into the map when `stage` changes, so write the HTML first.

```json
{
  "stage": "map",
  "sitemap": {
    "origin": "https://example.com",
    "screens": [
      {
        "id": "s-home", "kind": "page", "path": "/",
        "title": {"en": "Home", "zh": "首页"}, "shot": "data:image/jpeg;base64,…",
        "children": [
          {"id": "s-signin", "kind": "modal", "title": {"en": "Sign in", "zh": "登录"},
           "open": "Click Sign in in the top bar.",
           "note": {"en": "Opened from the top bar on every page.", "zh": "每个页面顶栏都能打开。"}},
          {"id": "s-blog-post", "kind": "page", "path": "/blog/how-we-ship", "count": 42,
           "title": {"en": "Blog post", "zh": "博客文章"}}
        ]
      }
    ],
    "workflows": [
      {
        "id": "w-signin", "title": {"en": "Sign in", "zh": "登录"},
        "goal": {"en": "From any page back to where you were, signed in", "zh": "从任意页面登录并回到原处"},
        "steps": [
          {"screen": "s-home", "action": {"en": "Click Sign in", "zh": "点击登录"}},
          {"screen": "s-signin", "action": {"en": "Enter email and password", "zh": "输入邮箱和密码"}}
        ]
      }
    ]
  }
}
```

| Key | Meaning |
|---|---|
| `origin` | The address the map was built from. |
| `screens` | The top-level screens. Each one may hold `children`. |
| `workflows` | The journeys. Leave it out, or empty, when the product has none. The map then shows only screens. |
| `id` | Stable across rounds. Start a screen's with `s-` and a workflow's with `w-`, because `patch` finds the first node with an id and task ids share the file. |
| `kind` | `page`, `modal`, `popup` (a menu, popover, dropdown or toast) or `panel` (a drawer or slide-in panel). |
| `title` | The name, in both languages. |
| `path` | The page's address, relative to `origin`. An overlay takes the path of the page that opens it, or none. |
| `open` | For an overlay, the steps that open it, in plain text. The screen's agent follows them. |
| `note` | Optional. One sentence the owner sees when they open the screen in the map, in both languages. |
| `count` | Optional. How many pages share this layout. |
| `children` | Pages reached from this one, and what opens on it. |
| `shot` | The screen's preview, as a `data:` URL. |
| `goal` | A workflow's outcome, as one line, in both languages. |
| `steps` | A workflow's steps, in order. Each names a screen `id` and the `action` taken there. |
| `off` | Optional. `true` starts a screen's or a workflow's switch off. Use it only in a later round. |

## Step B: The owner picks

The map is a stepped form: **Pages**, then **Workflows**. With one of them covered, it has a single step.

- **Pages** shows a tree. Every page has a switch, and every switch starts on. Clicking anywhere on a row switches it; the arrow opens what sits under it. Switching a page off switches off everything under it. **Include all**, above the list, turns them back on.
- **Workflows** shows one card per journey, its steps from left to right. The owner removes a card with its bin, steers one with a note, or adds a journey in their own words.
- Resting the pointer on a row or on a workflow step shows that screen in the preview.

Each steer, and each journey added, is sent as soon as the owner makes it, the way a steer is in the report. It saves `workflowEdits`, and the watcher reports `SENT`. **Review** waits until you have redrawn them:

```json
{"workflowEdits": {"steer": {"w-browser": "Start from the Software products page"}, "add": ["Contact the team"]}}
```

Redraw the workflows before the review:

1. For each steer, change that workflow's steps and goal as the note asks. Keep its id.
2. For each journey added, write a new workflow, with an id starting `w-`, and its steps from the map.
3. Write `sitemap.workflows`, then delete `workflowEdits`. Keep every other key. The page shows the redrawn cards and **Review** works again. Steers that arrive while you redraw are added to `workflowEdits`, so read it again before you delete it.

**Review** saves `exclude`, and the watcher reports `SENT`:

```json
{"exclude": ["s-blog", "s-blog-post", "w-read"]}
```

`exclude` holds the ids of every page switched off, every workflow removed, and everything the owner did not cover. It is an empty list when everything stays in. Review everything else.

## Step C: Review each screen and workflow

1. Set `status` to `queued` on every screen and workflow that `exclude` does not name. Use `patch` with `--set status=queued`.
2. Start one Host `subagent` per screen and per workflow, at the model and effort for `effort`, as in *Run the work in parallel* in Polish. Give each one a headless browser of its own.
3. Set `status` to `running` when an agent starts. For a workflow, set `at` to the index of the step it is on, from 0, as it reports moving on. The map puts the beam on that step.
4. When an agent returns, set `status` to `done` and `found` to the number of findings, or `status` to `failed`. For a workflow that broke, leave `at` on the step where it broke.
5. If the Host has no `subagent`, do the same work yourself, one item at a time: screens in map order, then workflows.

Give each screen's agent this brief, filled in:

```text
Review one screen of <origin> for Visual Stack Polish. Do not write the answers file
and do not change product code. Never submit a form, pay, delete or sign out.

Screen: <title> (<kind>), id <id>
Reach it: open <origin><path>, then <open>
Level: <level>. Mode: <mode>.
Checks: <path to skills/polish/lenses.md>, the sections for this level and mode.
Pictures: <path to skills/polish/report.md>, the section "Pictures".

Cover the screen as in "Covering the page" in lenses.md. Review only this screen:
for a page, leave out the overlays it opens; for an overlay, leave out the page behind it.

Save into <$R>.screens/<id>/:
- survey.md and checks.md, as lenses.md describes
- every screenshot a finding uses, with its screen size in the file name
- findings.json: an array of findings, each with check, title {en, zh},
  why {en, zh}, today, proposed, rect, loc and spec, as report.md describes
Return the number of findings, and anything you could not open or measure.
```

Give each workflow's agent this brief, filled in:

```text
Walk one workflow of <origin> for Visual Stack Polish, as a first-time visitor would,
and find what makes people give up. Do not write the answers file and do not change
product code. Never pay, delete or sign out. On a site we do not own, never submit
a form or send a message: fill each step with sample values and stop before the step
that submits, then judge what you can see up to there.

Workflow: <title>, id <id>. Outcome: <goal>
Steps: <each step: the screen, its address, and the action>
Checks: the workflow checks WF1 to WF7 in <path to this file>.
Pictures: <path to skills/polish/report.md>, the section "Pictures".

Walk it on an iPhone SE (375 x 667) first, then at 1440 x 900. At every step, give each
workflow check a verdict, and screenshot the step as you arrive. Report each step as you
reach it, so the map can follow you.

Save into <$R>.workflows/<id>/:
- walk.md: each step, what you did, what you saw, and each check's verdict
- every screenshot a finding uses, with its screen size in the file name
- findings.json: an array of findings, each with check, step (its index), title {en, zh},
  why {en, zh}, today, proposed, rect, loc and spec, as report.md describes. The why
  names the step, why people may give up there, and the smallest fix.
Return the number of findings, the step where the workflow broke if it did, and
anything you could not reach.
```

### Workflow checks

Give every check a verdict at every step. A failure is a finding only if it could make someone give up.

- **WF1 · Next step clear.** The control that moves the journey on is easy to find at every step. On a phone it shows without scrolling past unrelated content. It is the most prominent action, and its label says where it goes.
- **WF2 · No dead ends.** Every step has a way forward and a way back. No step leaves the journey: a sign-in wall without a return, a broken link, a link that opens elsewhere with no way back, or an empty result with no next step.
- **WF3 · Errors you can fix.** Wrong or missing input gets a message beside the field that says how to fix it, and everything typed stays. On a site we do not own, check what shows before anything is sent: messages as fields are left, and the browser's own checks.
- **WF4 · Pick up where you left off.** Back, refresh and reopening the link keep the visitor's place and what they typed. If something will be lost, the page says so first.
- **WF5 · No surprises.** Costs, fees, a required account and any other requirement show before the visitor puts in effort, not at the last step.
- **WF6 · Effort fits the goal.** The number of steps and fields fits what the visitor gets. Nothing is asked twice, and nothing is asked that the outcome does not need.
- **WF7 · The outcome is clear.** The last step confirms in plain words that it worked, and says what happens next. On a site we do not own, judge the last step you can reach without submitting.

## Step D: Merge into one report

1. Read every screen's and every workflow's `findings.json`.
2. Merge the same kind of defect found on several screens into one section, as Polish asks for one finding per kind of defect. Show it as a consistency finding: crops from up to three screens side by side as Today, the same crops fixed as Proposed. List every screen it affects in the section's spec.
3. Give each workflow with findings a category of its own, named after the workflow, such as "Buy a shirt". Put the workflow categories first, worst first, because a journey people cannot finish costs the most.
4. Show a workflow finding with the steps that lead to the break as Today, as a strip of up to four step pictures with a box on the step that breaks. Show the fixed step as Proposed.
5. Order the screen sections as *Categories* in `report.md` says.
6. Continue at item 2 of Step 4 in Polish.
7. In the chat reply, also give each screen's and each workflow's count, the step where each workflow broke, each item that failed and why, and what the map left out.

## Later rounds

- Reuse the last round's `sitemap`, with its ids, and copy `site-map.html` over the new round's page.
- Rebuild the map only when the owner asks, or when the product has new pages. Keep the ids of screens and workflows that are still there.
- Start the map with the switches the owner left off last round: give each of those screens and workflows `off: true`.

## Notes

- **Why two modes.** Each screen can pass on its own while the journey across them still fails: a sign-in wall in the middle of checkout, or a form that forgets what was typed. Screens finds what is wrong on a page. Workflows finds where people give up.
- **Why group pages by layout.** A product with 400 product pages has one product page layout. Reviewing one, at its longest, finds what reviewing all would, and keeps the map short enough to read.
- **Why each item gets its own agent.** One pass over a large product spends its attention on the first screens it opens. An agent per item gives every screen a full survey and every journey a full walk.
- **Why the survey clicks nothing.** A click can submit, pay or delete. `survey.js` only reads, and the agent decides what is safe to open.
