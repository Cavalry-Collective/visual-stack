# Changelog

What changed in each release of Visual Stack, newest first. Versions follow
[semantic versioning](https://semver.org). Full notes for each release are on
the [releases page](https://github.com/Cavalry-Collective/visual-stack/releases).

The version in `plugins/vstack/.claude-plugin/plugin.json` is what your host
compares against to decide an update is available. See the release checklist in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## 6.2.0 — 2026-08-09

**Changed**

- **Clear all no longer takes the comments you are still working on.** It clears
  the addressed ones, and a checkbox on the confirm takes the open ones as well.
  The box is off every time the dialog opens, so tidying the list can never lose
  a comment you had not finished with.
- **The banner that announces a finished round no longer names a version.** It
  says the round is done, which reads the same for a live app as for a
  wireframe, and the button beside it is now **Refresh**. A live review never
  advanced a version, so that banner had never appeared there at all.
- The handle that reopens the comments panel is part of the chrome again rather
  than wearing the brand colour. Its count badge is what says comments are
  waiting.

**Added**

- **`publish --summary "…"`** records the account of the round you would give in
  chat, and the workspace shows it under the banner. It opens and closes on an
  accordion chevron, and however you leave it is how the next round arrives.
  One summary is kept, the latest; a publish without it clears it.
- **`reply --option "…" --option "…" --recommend <n>`** turns a question into
  answers to pick from, one marked *Recommended*. Pressing one answers with
  those words, and the box to type something else is still there.
- **The comments panel is resizable.** Drag its inner edge, or focus it and use
  the arrow keys. The width is remembered for this browser.
- A comment about the page as a whole now has a **Save** button and the
  Shift+Enter hint, the same as one made on the page. Enter saves it as a draft
  instead of sending it — it goes out with your next Send, like every other
  comment.

**Fixed**

- **A comment closed while you watched dropped straight into the folded
  "Earlier" group.** The workspace never picked up the close stamp from the
  server, so everything read as closed long ago instead of standing where you
  could check it.
- **A question showed a progress bar while it waited on you.** A comment whose
  last word is the agent's no longer counts as work in flight: no bar, no place
  in the "working on N" count, and it does not trip the stalled timer.
- The stack catalogue the parked `start` tool shows named packs the template no
  longer has.

## 6.1.0 — 2026-08-08

**Fixed**

- **A second session in the same project was gated on a review it had never
  seen.** With two agent sessions open in one directory, the Stop hook told the
  uninvolved one it owed answers on another session's comments — naming the ids
  and the command that would close them, which invited the wrong session to
  finish someone else's round. Delivery now records the session it went to: the
  watcher is started with `--session <id>` (the host adapter supplies the id),
  and the gate asks `unanswered --session <id>`, so it holds only the session
  whose watcher took delivery. A delivery recorded without an identity gates no
  one.

**Added**

- **A watcher never covers a review another session already covers.**
  `watch --all` leaves a store alone while its `watching` heartbeat is fresh,
  and takes it once that heartbeat is gone — so a second session's sweep cannot
  take delivery of comments meant for the first. Naming the page with `--file`
  still covers it regardless: that is the deliberate way to adopt a review from
  a watcher that is stuck.

## 6.0.0 — 2026-08-06

**Breaking**

- **Rounds are gone.** A review is one list of comments, each open or closed, and
  the agent is the only one who closes. `rounds/`, the `pending` sentinel, the
  per-version comment copies and `feedback.json` are no longer written. `claim`
  and `check` are removed: taking delivery is the tick itself, and there is no
  unclaimed round to name.
- **`publish --addressed` is now `publish --close`,** and it no longer has to
  account for every comment. What you close is closed; what you leave stays open
  and comes back on the next delivery. `--label` is independent of it: either
  flag alone is valid.
- **On-disk shape.** Comments live in `comments.json`; the brief is `brief.md`,
  rewritten on each delivery. A store written by an earlier version is read where
  it lies — newest copy of each id wins, `addressed` and dismissed both become
  closed — and nothing is moved.
- **A version records no comments.** `versions/v<n>.meta.json` is a label and a
  date. Snapshots are for looking at.

**Added**

- **A round the agent took is finished before its turn can end.** `unanswered`
  reports every comment the agent was handed and then said nothing about —
  neither closed nor replied to. On Claude Code a Stop hook runs it and holds the
  turn open until the round is answered. Nothing else caught this: a delivery
  only fires when the reviewer writes again, so a comment the agent went quiet on
  sat there for as long as they stayed quiet too.
- **Send again, when the agent stops responding.** After a minute with nothing
  listening, the workspace says the agent has stalled rather than animating
  progress that is not happening, and offers to put those comments back in the
  queue. A comment already delivered is invisible to a watcher started
  afterwards, so a restarted session used to sit idle on a review it could not be
  handed. Refused while a heartbeat says an agent still holds them.
- **Hard reset**, in the cog. Starts a review over, behind a confirm that says how
  many comments and versions go. The page under review is left alone and becomes
  v1 again.

**Fixed**

- **What a failed action had to say could not be read.** A message raised while a
  dialog was open sat under that dialog's own backdrop, dimmed and blurred by it.
  Messages now join the top layer, so they arrive on top of the thing that
  failed.
- **A comment could stop being closable.** Replying to one changed the
  fingerprint its round had recorded, so the reviewer answering the agent's own
  question was what blocked the comment from ever closing — and the workspace
  held back the re-send that would have cleared it. Neither rule exists now, and
  the protocol states the property that was missing: nothing can refuse a close.
  An agent that has taken delivery can always finish.

**Changed**

- A comment's words are frozen when the reviewer sends it. Anything to add after
  that is a reply, which means two writers can no longer disagree about what was
  asked, and the merge heuristics that arbitrated them are gone.
- `question` is no longer a state — a comment waits on the reviewer when the last
  reply is the agent's. Withdrawing a comment already delivered is a reply asking
  for it back. Revert and Refine both write into the thread.
- The workspace holds no protocol state. Queued, being worked on, editable and
  withdrawable are all read off the comment, so a reload or a second tab sees the
  same review as the tab that wrote it.

## 5.0.0 — 2026-08-05

**Breaking**

- **Stop is withdrawn.** Asking the agent to stop a round mid-flight could not
  do the one thing it promised — interrupt the turn — so it is out rather than
  half-working. The `cancelled` command, `/api/cancel`, the `cancel` sentinel
  and the `CANCELLED` stream event are gone, and `check` always exits `0`. A
  round already on disk with status `cancelled` stays terminal, so nothing in
  your project needs migrating. What it would have to do to come back is written
  down in [`docs/review-wishlist.md`](docs/review-wishlist.md).
- **Host profiles move to `plugins/vstack/host-profiles/`.** `hosts/` now holds
  only the adapter markdown that maps review operations to a product's tools.
  This is inside the plugin, so an installed copy updates itself.

**Added and fixed**

- **Linked now means a session is listening.** The workspace used to show Linked
  on evidence a session could produce without receiving anything. A stream
  watcher now opens with a `HANDSHAKE` line naming a command, and its heartbeat
  only starts once `ack` answers it; unanswered, the watcher exits after two
  minutes (`--handshake-timeout <seconds>`). Presence also requires rounds to
  move: one queued and unclaimed for 90 seconds drops the link, because a
  watcher whose events nobody reads should look the same to you as no watcher at
  all. A watcher covering no review reports `UNLINKED` rather than `LINKED`.
- **The cog says which version you are on.** It shows the version the workspace
  loaded with and the one the server is running now, and offers a reload when
  they differ — so a tab left open across an update says so.
- **An answer written on a comment carried in from an earlier version is kept.**
  Replies and note edits copy the comment into the current version first, so the
  answer lands in the file the workspace reads back.
- **Two new ways to mark up a page: Move and Delete.** A toolbar beside the page
  holds Comment, Move and Delete — what Annotate draws with, on keys `c`, `m`
  and `d`. Neither new tool needs a note: the mark is the instruction, and
  anything you type adds to it. Both outline whatever the pointer is over, so
  the element the gesture will take is settled before you press.
  - **Move** draws an arrow from a thing to where it should go. It records the
    element you dropped it on and which side of it — inside, before, or after —
    so your agent is told "after the Cancel button" rather than "180px right",
    which stops meaning anything the moment the page reflows.
  - **Delete** strikes out what should go. Drag across text and exactly those
    words are marked for removal; the strike finds them again by their text when
    the page is rebuilt, so it stays on them. Click an element instead and the
    whole thing is marked.
- **A watcher finds a review whose page lives outside the directory it was
  started from.** A review's files sit beside the page under review, and
  `watch --all` found them by walking the directory it ran in. A page written to
  a temp directory took its files with it, so the watcher walked straight past a
  running review and the workspace said Unlinked while a session was in fact
  listening. Serving now leaves a pointer where it was run from, and the watcher
  follows it.
- **A watcher that covers no review says so.** It reports `UNLINKED` instead of
  `LINKED`, because nothing is listening to any workspace at that point whatever
  the handshake proved. A handshake also carries the token it printed, so one
  watcher's answer no longer brings a different watcher live.

## 4.8.1 — 2026-08-05

- **The comment composer's send button is readable in dark mode.** Its label was
  fixed to white while its background follows `--ink`, which is the text colour
  and therefore near-white under a dark theme. The button rendered as a blank
  white box, at a contrast of 1.12:1. The label now follows `--surface`, the
  pairing the rest of the interface already uses, giving 15.70:1 in dark and
  leaving light mode exactly as it was.

## 4.8.0 — 2026-08-04

- **The plugin declares a version.** Until now it shipped without one, so every
  commit to `main` counted as a release. Your host now compares version numbers
  and updates when this number changes. A copy installed before this release has
  no version on record and keeps comparing commits until it updates once.
- **A comment lands on the element it was left on, not a lookalike.** The
  selector recorded for a comment was cut off after eight steps, and a short
  path can first-match a different element elsewhere on the page, which is the
  one `querySelector` returns. The recorded selector is now the shortest one
  that matches a single element, and a path still ambiguous at full length is
  rooted at `body` so the chain is exact.
- **Reanchoring prefers the element carrying the comment's words.** When a
  selector still parses but its match shares nothing with what was captured, an
  element scoring on text or identity is now taken ahead of it.
- Both host manifests carry the full set of distribution metadata: version,
  display name, homepage, repository, license, and keywords covering what
  someone would search for. Descriptions across all three manifests are drawn
  from the README.
- CI runs the tests on Node 18 and 22, checks the stamped shell for drift, and
  validates both manifests with the same tool the community-marketplace review
  pipeline runs. A release workflow rejects a tag that disagrees with the
  manifest version.
- Issue and pull request templates, a changelog, and a release procedure in
  `CONTRIBUTING.md`.

## 4.7.0 — 2026-08-04

- A question the agent asks is carried onto the next version and drawn in the
  comments list, with a reply box already open. Carried questions were counted
  everywhere but had no card, so there was no way to answer or dismiss one.
- A carried card says which version raised it, as `from r3` in a live app review
  and `from v3` in a wireframe review.
- The walk over earlier versions sorts explicitly, rather than relying on
  integer-like object keys happening to iterate in order.

## 4.6.0 — 2026-08-04

- **The wireframe tool is now `/vstack:review`.** `/vstack:wireframe` still works
  as a thin alias. Rounds already under `.vstack/local/wireframe/` keep working,
  and nothing is migrated behind your back.
- **Three ways a comment could go missing, fixed.** A save no longer deletes
  comments it did not mention, a reply lands in the version the workspace has
  open, and a question survives the next publication.
- The project-planning tools (spec, start, phase-build, phase-preview, and the
  `go` alias) move to `experimental/`, where no host discovers them. `review` and
  `user-story-map` are what ships.
- Comments anchor to what you clicked on a page that scrolls its own window.
- Addressed comments read green across the mark, the card, and the composer.
- One live-link client and one heartbeat protocol shared by the review server
  and the JSON bridge.

## 4.5.0 — 2026-08-03

- Machine state and pipeline state split first, tool name second. Everything
  per-machine lives under `.vstack/local/<tool>/`, gitignored by one line.
  `pipeline.json`, `specs/`, and `build/` stay tracked.
- The JSON bridge takes `--tool`, so the skills that share it get their own
  directories.

## 4.4.0 — 2026-08-03

- The tools stop scattering dot-directories. `.ui-review/<name>/` and
  `.vstack-bridge/` move under `.vstack/`.
- **Breaking:** reviews in flight under `.ui-review/`, and comment drafts under
  the `ui-review:*` `localStorage` keys, are orphaned. There is no migration.
  Finish or discard any open review before updating.

## 4.3.0 — 2026-08-03

- **Codex host.** Install from the Codex marketplace and invoke `$wireframe` to
  build or review a UI in the annotation workspace.
- `hosts/codex.json` carries Codex's labels, capabilities, and update commands.
  Skills still depend only on the contract, never on a particular agent product.
- Clearing a review opens a confirm dialog that says how many comments go.
- The comments panel becomes its own full-width view below 720px.
- Merging server state no longer undoes a local dismissal, reply, or reopen that
  is still inside the autosave window.

## 4.2.0 — 2026-08-01

- **Shared shell.** One top bar, palette, theme, and scrubber for every tool page.
- **Live wireframe review.** Point the workspace at a localhost app or a public
  site and it proxies the real screens, so comments land on them.
- **`/vstack:phase-preview`** (was `phase-wireframe`).
- Each local server checks once whether the plugin has moved on, and shows one
  dismissable line when it has. Opt out with `VSTACK_NO_UPDATE_CHECK=1`.

## 4.1.0 — 2026-07-30

- **Visual Stack.** A name, a mark, and three new skills: `/vstack:go`,
  `/vstack:spec`, and `/vstack:phase-build`.
- `/vstack:init` becomes `/vstack:start`, and now also sets up a design-only
  workspace or connects an existing codebase without touching it.

## 2.0.0 — 2026-07-28

- **Breaking:** `/cavalry:ui-review` becomes `/cavalry:wireframe`.
- Adds `init` and `phase-wireframe`.
- Approve and cancel from the workspace. Publishing a shareable link publishes
  the design rather than the review workspace.

## 1.1.0 — 2026-07-27

- Adds the **ui-review** skill: annotate on the page itself, with severity,
  threaded replies, viewport switching, and a version timeline.
- Both skills get a live link back to the agent session, so feedback returns
  without copy-paste.

## 1.0.0 — 2026-07-27

- First release, shipping the **user-story-map** skill: journey activities as
  columns, release phases as rows, stories as drag-and-drop cards.
