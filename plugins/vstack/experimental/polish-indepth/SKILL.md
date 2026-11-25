---
name: polish-indepth
description: Experimental in-depth mode for Visual Stack Polish. Maps a whole site or web app into its pages, modals, popups and slide-in panels, reviews every screen with its own agent at the depth the owner sets for it, or skips it, and merges the findings into one Polish report. Read by vstack:polish when the owner turns on In depth; not a skill of its own.
---

# Polish in depth (experimental)

A normal Polish round audits a product in one pass. On a whole site or a large web app, that pass reaches a few screens and returns few findings. In-depth mode maps the product first, reviews every screen on it with its own agent, and lets the owner set how deep each one goes or skip it.

Polish reads this file when the answers file holds `"indepth": true`. Follow `../../skills/polish/SKILL.md` as usual, with these changes:

| Polish step | In depth |
|---|---|
| Step 1 and Step 2 | Unchanged. |
| Step 3 | Replaced by Steps A to C below. |
| Step 4 | Starts with Step D below, then continues at item 2, *Build the review*. |
| Step 5 and later rounds | Unchanged, except *Later rounds* below. |

`$R`, `$LIB`, the watcher and *Show progress* are Polish's. Keep serving the page and answering watcher events yourself while subagents work.

## Step A: Build the site map

Show progress while you map, as in *Show progress* in Polish. Name the tasks after the work, such as "Read the routes", "Walk the navigation" and "Open popups and panels".

### Find the pages

1. If the code is in this repo, read the router first: file-based routes, a route table or a sitemap generator. It is the most complete list.
2. On a live site, read `/robots.txt` and the sitemaps it names, or `/sitemap.xml`.
3. Walk the product. Open the target with `browser_capture`, evaluate `assets/survey.js` in the tab, and follow the `links` it returns, breadth first.
4. Stop at three links from the start or 200 pages, whichever comes first. Say in chat where you stopped.
5. Group pages that share one layout into one screen, such as blog posts or product pages. Give it `count`. Check only one of them, the one with the longest content. The map says so on the screen's row.

### Find what opens on each page

1. Read `triggers` and `overlays` from `survey.js` on every page you keep.
2. Open each trigger whose `submits` is `false`. Record what opens, then close it with Escape or its close button.
3. Also open the menu at phone width, any cookie or consent banner, and any toast a safe action shows.
4. Never open a trigger that submits, pays, deletes, signs out or sends a message. On a site you do not own, never submit a form or pay.
5. Record an overlay that appears on many pages, such as the site menu, once, under the first page that shows it.

If the target asks for a sign-in, follow Step 3 of Polish.

### Write the map

1. Take a preview of every screen while you map it: a screenshot at desktop size, with any overlay open, 400 px wide, as a JPEG at quality 60. Put it in the screen's `shot` as a `data:` URL. The owner sees it when the pointer rests on the screen's row.
2. Copy `assets/site-map.html` over `$R.html`.
3. Write `sitemap` to the answers file, and set `stage` to `map`. Keep every other key. The open tab reloads into the map when `stage` changes, so write the HTML first.
4. Suggest a depth for a screen that needs more or less than Standard, in its `depth`. Give the main flow and anything that takes payment `deep`. Give a banner or a toast `quick`. Say in chat why.

```json
{
  "stage": "map",
  "sitemap": {
    "origin": "https://example.com",
    "screens": [
      {
        "id": "s-home", "kind": "page", "path": "/", "depth": "deep",
        "title": {"en": "Home", "zh": "首页"}, "shot": "data:image/jpeg;base64,…",
        "children": [
          {"id": "s-signin", "kind": "modal", "title": {"en": "Sign in", "zh": "登录"},
           "open": "Click Sign in in the top bar.",
           "note": {"en": "Opened from the top bar on every page.", "zh": "每个页面顶栏都能打开。"}},
          {"id": "s-blog-post", "kind": "page", "path": "/blog/how-we-ship", "count": 42,
           "title": {"en": "Blog post", "zh": "博客文章"}}
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
| `id` | Stable across rounds. Start it with `s-`, because `patch` finds the first node with an id and task ids share the file. |
| `kind` | `page`, `modal`, `popup` (a menu, popover, dropdown or toast) or `panel` (a drawer or slide-in panel). |
| `title` | The screen's name, in both languages. |
| `path` | The page's address, relative to `origin`. An overlay takes the path of the page that opens it, or none. |
| `open` | For an overlay, the steps that open it, in plain text. The screen's agent follows them. |
| `note` | Optional. One sentence the owner sees when they open the screen in the map, in both languages. |
| `count` | Optional. How many pages share this layout. |
| `children` | Pages reached from this one, and what opens on it. |
| `shot` | The screen's preview, as a `data:` URL. |
| `depth` | Optional. Your suggested depth, `quick`, `standard`, `deep` or `skip`. Missing means `standard`. |

## Step B: The owner picks

The map shows every screen as a tree, each one set to the depth you suggested. The owner rests the pointer on a screen to see its preview, and opens it to see what sits under it. They can set each screen's depth, skip it, or set every screen at once. Setting a page also sets everything under it.

**Review** saves `plan`, and the watcher reports `SENT`:

```json
{"plan": {"s-home": "deep", "s-signin": "standard", "s-blog-post": "skip"}}
```

`plan` holds every screen on the map, by id. Review every screen not set to `skip`, at its depth. Depth decides how much of a screen its agent covers. It is separate from `effort`, which picks the model.

| Depth | 中文 | Each screen's agent covers |
|---|---|---|
| **Quick** | 快速 | Desktop size, as the screen first appears. |
| **Standard** | 标准 | Every check for the level, at each screen size in `lenses.md`. |
| **Deep** | 深入 | Standard, plus every state: empty, longest content, error, loading, hover and focus, and both themes. |

## Step C: Review each screen

1. Set `status` to `queued` on every screen `plan` does not skip. Use `patch` with `--set status=queued`.
2. Start one Host `subagent` per screen, at the model and effort for `effort`, as in *Run at the chosen effort* in Polish. Run at most four at once, each in its own browser tab.
3. Set the screen's `status` to `running` when its agent starts. When it returns, set `status` to `done` and `found` to the number of findings, or `status` to `failed`.
4. If the Host has no `subagent`, review the screens yourself, one at a time, in map order.

Give each agent this brief, filled in:

```text
Review one screen of <origin> for Visual Stack Polish. Do not write the answers file
and do not change product code. Never submit a form, pay, delete or sign out.

Screen: <title> (<kind>), id <id>
Reach it: open <origin><path>, then <open>
Level: <level>. Mode: <mode>. Depth: <depth>, which means <the depth row above>.
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

## Step D: Merge into one report

1. Read every screen's `findings.json`.
2. Merge the same kind of defect found on several screens into one section, as Polish asks for one finding per kind of defect. Show it as a consistency finding: crops from up to three screens side by side as Today, the same crops fixed as Proposed. List every screen it affects in the section's spec.
3. Order the sections as *Categories* in `report.md` says.
4. Continue at item 2 of Step 4 in Polish.
5. In the chat reply, also give each screen's count, each screen that failed and why, and what the map left out.

## Later rounds

- Reuse the last round's `sitemap`, with its ids, and copy `site-map.html` over the new round's page.
- Rebuild the map only when the owner asks, or when the product has new pages. Keep the ids of screens that are still there.
- Start the map with the last round's `plan` as each screen's `depth`.

## Notes

- **Why group pages by layout.** A product with 400 product pages has one product page layout. Reviewing one, at its longest, finds what reviewing all would, and keeps the map short enough to read.
- **Why each screen gets its own agent.** One pass over a large product spends its attention on the first screens it opens. An agent per screen gives every picked screen a full survey and a verdict on every check.
- **Why the survey clicks nothing.** A click can submit, pay or delete. `survey.js` only reads, and the agent decides what is safe to open.
