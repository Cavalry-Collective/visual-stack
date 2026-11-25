# Changelog

What changed in each release of Visual Stack, newest first. Versions follow
[semantic versioning](https://semver.org). Full notes for each release are on
the [releases page](https://github.com/Cavalry-Collective/visual-stack/releases).

The version in `plugins/vstack/.claude-plugin/plugin.json` is what your host
compares against to decide an update is available. See the release checklist in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## 6.21.0 — 2026-11-26

**Removed**

- **Live view in Polish.** The experimental switch, and the live pictures it
  showed on the progress page, are gone. The progress page keeps its task list
  and animation.

**Changed**

- **In-depth Polish: the map is quicker to work through.**
  - Click anywhere on a page's row to switch it on or off. The arrow still
    opens what sits under it.
  - Include all sits above the list of pages it turns back on.
  - A steer, or a workflow you add, goes to the agent as soon as you send it,
    the way a steer does in the report. Review waits until the agent has
    redrawn it.
  - Back is a round button to the left of the title.
  - After Review, the map goes back to the first step and shows the first
    thing being reviewed.

## 6.20.0 — 2026-11-25

**Added**

- **Polish has an in-depth mode, as an experiment.** Turn on **In depth**
  under Experimental, or ask for an in-depth review in chat. It is for a whole
  site or a large web app, where one pass finds too little.
  - After you pick a level, choose what to cover: **Pages** (is each page
    right?), **Workflows** (can people finish what they came to do?) or
    **Both**. Polish maps only what you chose, so it starts sooner.
  - A rail of steps runs across the top of every page in the run: Level,
    Cover, Map, Review and Report.
  - The map is a stepped form: pages first, then workflows. Pages that share
    one layout, such as 200 product pages, appear once, and Polish checks one
    of them. Switch off any page you want left out.
  - Each workflow is a card with its steps. Remove one, steer one with a
    note, or add a journey in your own words, and Polish redraws them before
    the review.
  - Rest the pointer on a page or a step to see it in the preview beside the
    map.
  - Each page and each workflow gets its own agent. A workflow review walks
    the journey from start to finish and finds the step where people give up.
    The map shows what is being reviewed and which step each workflow has
    reached, and the findings come back as one Polish report.

  While it maps a site you do not own, Polish never submits a form or pays.

**Changed**

- **A Polish report won't let you finish too early.** While the agent is still
  revising a section you steered, or a section has no answer, the last slide
  names it and offers Go to it in place of Approve & finish.

## 6.19.0 — 2026-11-24

**Added**

- **Live view in Polish, experimental and off by default.** Turn it on under
  Experimental. While the audit runs, the progress page shows the latest frame
  from each of the agent's browsers in place of the animation. The newest frame
  is outlined. The animation stays when the audit runs in your own browser tab.
- **Refined checks tooltips and hover content.** Polish hovers, focuses and
  long-presses every element that reveals something, such as a tooltip, a hover
  card or row actions. It checks that each one also works by keyboard and on a
  touch screen, stays on screen, and is never the only way to reach an action.
- **Refined operates every input.** Polish opens every select and drop-down,
  types into search fields and comboboxes, picks dates, toggles checkboxes,
  radio buttons and switches, drags sliders and chooses files, first with the
  mouse and then with the keyboard. It checks that each one responds to the
  keys users expect, shows what was chosen, and works on a phone.

**Changed**

- **Clean opens modals, drawers and panels, and steps through stepped forms.**
  Clean judges how each one looks. It fills each form step with valid sample
  values and stops before the step that submits, pays or sends.
- **The Polish survey records what each element opens,** with a screenshot of
  each state, so every modal, drawer, panel, menu, form step and tooltip gets a
  verdict.

## 6.18.2 — 2026-11-22

**Fixed**

- **Polish says which effort its first worker runs at.** The worker that reads
  the project starts before you pick a level, so it runs at Medium, the
  default. Every worker after the pick runs at the effort you chose.

## 6.18.1 — 2026-11-22

**Fixed**

- **The Polish start page groups its switches in a way screen readers
  recognise everywhere.** The Checks and Experimental switches now sit in
  native fieldsets.

## 6.18.0 — 2026-11-22

**Added**

- **Failure handling is an option in Polish, off by default.** Turn it on under
  Options, beside Effort, and it works at any level. Polish then takes down
  each backend, embedded service and third-party script in turn, and lets each
  one hang. It checks that:
  - the rest of the page still loads and works, with no white screen;
  - every loader turns into content or an error within about 10 seconds;
  - a feature that fails says so, and never disappears without a message;
  - a failure never reads as an empty result, such as "No classes available";
  - a control that needs missing data is disabled, and says why;
  - a retry works without reloading the page, and the feature recovers once the
    service is back;
  - a flow with steps keeps earlier choices after a failure.

  The option also runs the failure checks that 6.17.0 added to Refined: hung
  submits, lost connections, expired sessions, missing access, payment declines
  and failed uploads.
- **Polish runs its work in parallel.** On a host that can start helper agents,
  Polish reads the project while you pick a level. It then walks each flow,
  forces each failure, and builds each report section in a separate worker, so
  a round finishes sooner. The workers run at the effort you pick. Codex, which
  cannot start helpers, runs each step in turn as before.

**Changed**

- **Refined no longer forces failures.** Turn on Failure handling to get the
  checks 6.17.0 added to Refined. Refined still checks that error messages are
  plain and helpful, and that a failed submit keeps what you typed.

## 6.17.0 — 2026-11-20

**Added**

- **Polish checks how the product handles failure.** A Refined review now
  forces each failure on purpose: it goes offline, fails or delays a request,
  and pays with a test card that declines. It then checks that:
  - every error says what happened and what to do, in plain words;
  - a hung submit stops waiting, and a retry never sends twice;
  - a screen or panel that fails to load offers a retry;
  - missing access, a missing record and a rate limit each have their own
    message;
  - a declined payment says why, keeps the card details, and offers another
    way to pay;
  - a failed upload can be retried without choosing the file again.

  On a site you do not own, Polish still never submits a form or pays.

## 6.16.0 — 2026-11-19

**Changed**

- **Design review is now Polish.** Run `/vstack:polish`, or `$vstack:polish`
  in Codex. `/vstack:design-review` still works as an alias. New rounds are
  saved under `.vstack/local/polish/`, and rounds already under
  `.vstack/local/design-review/` are still read where they are, with nothing
  moved behind your back.
- **Every page's top bar names the product and the tool,** such as Visual
  Stack Polish and Visual Stack Review, in English in either language.

**Added**

- **Effort.** Polish's start page offers Low, Medium and High.
  Each runs the review on a set model and reasoning effort; under Claude Code
  that is Sonnet at low, Opus at medium and Fable at high. Medium is the
  default.
- **Polish runs under Codex.** The page waits in short, repeated calls
  the way review does under Codex, so your answers reach Codex, and the page
  names Codex as the agent.
- **Two experiments, both off by default.** Proofread passes the report's
  words and new UI copy to ChatGPT in your browser. Trim AI filler adds a
  check that flags text explaining the screen when it does not need it.

**Also changed**

- **Showcase aims higher.** It now leads with animation, parallax, smooth
  transitions, scroll interactions and playful details, proposes six to eight
  changes with two major ones, and still gives every effect a reduced-motion
  version and leaves the browser's own scrolling alone.
- **Two buttons and a link.** Each finding has Approve and Reject, with
  Steer as a link beside them. Steer opens the note box, which also offers to
  ask for other ways to fix the problem; that needs no note, a message
  confirms it, and the page moves to the next finding.
- **Finishing is on the last slide.** The last slide shows Approve & finish
  with a line saying what it builds. Send appears beside it only while
  something is unsent.
- **The findings list is a drawer on a phone.** Below 1100 px, the list
  folds into the left edge behind a tab, the same handle the review
  workspace uses for its comments panel. The tab counts the findings still
  unanswered. It replaces the row of chips under the title.
- **Options fold under the panels.** The start page leads with the three
  levels. Delivery, Effort and the experiments sit underneath as one line,
  such as "Build in this repo · Medium effort", and Change opens them. Each
  setting's hint is one short line.
- **A cleaner variation picker.** The variations are now a small switcher of
  their names in the Proposed caption, right above the picture they change,
  with a tick on the one you approved. Approve always says Approve.

- **Copy decisions hands over the whole review.** A report opened as an
  Artifact or off disk copies a brief that another agent can act on with no
  other context. It holds the target, the delivery, the screen sizes checked,
  and, for each section, your decision and note, the reason, both captions and
  an exact spec of the change.

- **Clean covers the whole page.** Your agent lists every section and control
  first, opens every menu, drop-down and form step to see how each looks, and
  gives every check a pass or a fail. It never submits a form on a site it
  does not own.
- **Real phone sizes.** Phone checks use iPhone screen sizes, height as well as
  width, so the first screen is judged as an iPhone SE shows it.
- **Only what you can see.** A failed check becomes a slide only if the problem
  shows in the picture. The rest is listed in chat. Consistency problems, such
  as buttons in several shapes, show every instance side by side, with Today
  above Proposed so both stay large.
- **Pictures match their captions.** Your agent checks each proposal picture
  before writing its caption, and uses only pictures from the current round.

## 6.15.0 — 2026-11-18

**Changed**

- **Design reviews follow a checklist.** Your agent reviews as a senior UI/UX
  designer would, against a named list of checks. The report groups each
  finding under the check it failed, named in plain words.
- **Clean finds what looks wrong.** It checks hierarchy, spacing, alignment,
  type, colour, components, responsive layout at six widths, and copy.
- **Refined finds what behaves wrong.** It drives every flow with a slow
  network. It checks that links are real links, that forms validate at the
  right moment, and that only the button you pressed shows a loader. It also
  checks that nothing loads in a jarring way, and that no library default, such
  as Ant Design's spinner, ships.
- **Showcase adds flair.** It no longer checks anything. Your agent names a
  creative idea taken from your brand, proposes four to six enhancements, and
  offers one major change in a bold and a restrained version.
- **Website or web app.** Each level has extra checks for a website, such as
  the first screen and conversion, and for a web app, such as URL state, data
  states and recovering from failures. Your agent picks the mode for each flow
  and says which one it chose. Sign-in and checkout count as web app even on a
  marketing site.
- **One section at a time.** The report shows each finding on its own, like a
  slide. Move with Previous and Next or the arrow keys. Approve and Reject take
  you to the next section with no answer, and the decision buttons stay in view
  while you scroll. Moving to another section sends the answer you left, so
  your agent starts on a steer while you carry on. The Done group is gone,
  since nothing needs folding away.
- **Each finding says why.** One or two lines under the title say, in plain
  words, what visitors see today, why it matters and what changes.
- **Findings are grouped by check.** The report lists every finding under the
  check it failed. Severity tags, before-and-after number pills, the plan, the
  date line, the answered counter, the keyboard hints and the Owner's call tag
  are gone.
- **A livelier wait.** While your agent prepares the review, the start page
  shows a mock page being scanned and marked up, and ticks each step as it
  finishes. The level panels' text is shorter.
- **One language switch.** Change language in the page's settings. The extra
  中文 button in the top bar is gone.
- **Clearer pages on a phone.** The progress page shows the status before the
  mock page. The level previews sit under their text. Buttons in the report
  and the top bar are 44px tall on touch screens.
- **Type from the design guide.** The review pages use only 12, 14, 20 and
  28px text. A finding's title now outranks its category.
- **Send rests neutral.** With nothing to send, both halves of the Send button
  look the same, in every Visual Stack page.
- **No proofread step.** A design review no longer sends the report's words or
  new UI copy to ChatGPT. Run `/vstack:proofread` yourself when you want it.

**Added**

- **A recommended level.** While you read the level panels, your agent takes a
  quick look at the site and marks one level Recommended, with the reason.
- **Build or report.** The start page shows whether your agent will build the
  approved changes in this repo, or write a report of them for a site whose
  code you don't have. You can switch before you pick. The report shows every
  approved change in one page you can share.
- **Retry.** When your agent stops with a problem, such as a site that needs a
  sign-in, the page shows it with a Retry button. Sign in, press Retry, and your
  agent tries that step again.
- **Sites behind a sign-in.** For a target behind Google sign-in, IAP or SSO,
  your agent opens it in your own browser and asks you to sign in there. It
  never types a password.
- **Finishing files the review.** After Approve & finish, the approved screens
  settle into a stack under an Approved stamp. Approving a section presses the
  same stamp onto its proposal.
- **Small moments of motion.** The three levels deal out from one stack when
  the start page opens, and each red box draws itself when its slide opens.
  Reduced motion turns these off.

**Fixed**

- **A report with nothing to change** now says so, where it used to break.
- **Send with an empty Steer** opens that section and asks for the note. It
  used to say Sent and hold the Steer back.
- **Back** closes a full-size picture rather than leaving the report.
- **Esc** closes the ▾ menu beside Send.
- **The Refined preview** shows working controls, without the depth that
  Showcase owns.

## 6.14.0 — 2026-11-18

**Added**

- **Pick the level in the page.** A design review opens on three panels: Clean,
  Refined and Showcase. Point at one to see what that level feels like, then
  click it to start. Your agent no longer asks in chat. Later rounds keep the
  last level.
- **Watch the review being prepared.** After you pick, the page lists what your
  agent will do and ticks each step as it finishes. The same tab turns into the
  report when it is ready.
- **English and 中文.** Switch language in the page's settings. The level
  panels, the task list, the report's buttons and the findings themselves all
  follow it.

- **Answered sections fold away.** Approve or reject a section and it folds to
  one line. Once sent, it moves to a Done group at the end, so a revision comes
  back at the top. Click a title to open it again.
- **A section you steered waits behind a blur.** Its pictures blur, and a card
  says your agent is revising it and quotes your note.
- **You see when your agent answers.** The screen's edges glow, the section says
  Ready, and the tab title flashes if you are in another tab.

**Changed**

- **Smaller, quieter text.** The report uses the dense end of the type scale.
  The severity counts, the instructions line, the "every section is answered"
  line and the footer are gone.
- **Pictures are always screenshots.** Your agent no longer puts a list of
  changes where a picture belongs. Red boxes are placed from measured pixels,
  so they stay on their target at every width.

**Fixed**

- **A new steer starts with an empty note.** The note you sent last time no
  longer reappears in the box.

## 6.13.0 — 2026-11-14

**Added**

- **Variations live inside one section.** When there is more than one way to fix a
  problem, the report shows them as A, B, C tabs beside Today, rather than as
  separate sections. Approve records the variation on show.
- **Ask for more variations.** Each section has a Variations button, or press V.
  Add a direction if you want one. Your agent adds the new variations to the same
  section and marks them New.

**Fixed**

- **A steer box closes once you send it.** The section then quotes your note while
  your agent revises it. Press Steer again to edit the note.

## 6.12.0 — 2026-11-12

**Changed**

- **A design review opens in its own tab.** Reports no longer appear at 70% inside
  the review workspace. They open at full size in your browser and reach your agent
  through the same live link as the story map.
- **Steering gets a response.** After you send a steer, the section shows that your
  agent is revising it. When the new proposal arrives, the page offers to show it,
  marks the section Revised, quotes your note, and asks for a fresh answer.
- **One Send button.** Send sits in the top bar with a count of unsent answers.
  Approve the rest and Approve & finish sit under the ▾ beside it. Approve & finish
  shows how many approved sections will be built.
- **The report looks like the rest of Visual Stack.** It wears the shared top bar,
  theme switch and link status. An index and your progress stay in view as you
  scroll.
- **Pictures show at full height.** Click any picture to see it full size, and press
  Space to flip between Today and Proposed.
- **Answer from the keyboard.** J and K move between sections. A, R and S approve,
  reject and steer.
- **The report's words are proofread.** `/vstack:design-review` now runs the
  report's titles and captions through `/vstack:proofread`, and removes text that
  repeats what a picture already shows.

When a report is opened from disk or as an Artifact, Send becomes Copy decisions,
so you can paste your answers into chat.

## 6.11.0 — 2026-11-10

**Changed**

- **A design review is a set of pictures you answer in place.** Each finding is a
  short title and a before and after picture. The long text, the metric tiles and
  the verdict paragraph are gone.
- **Approve, Reject or Steer on every finding.** The bar sits in the same place on
  each section. Send decisions delivers your answers as one comment. Approve & finish
  ends the review from the page.
- **One report template.** `/vstack:design-review` now fills a shipped template
  instead of writing a new page each time, so every report looks the same and takes
  the design guide's palette.
- **Page controls work while you annotate.** A button marked `data-vstack-control`,
  or an in-page link, takes your click in Annotate mode. It no longer opens a comment.

**Fixed**

- **Approving no longer reports a failure.** Approve & finish closed the review but
  threw an error before showing the closing screen, so the workspace said approval
  failed. The closing screen now appears.

## 6.10.0 — 2026-11-06

**Added**

- **Audit a UI before changing it.** `/vstack:design-review` looks at what you are
  working on, at a polish level you choose: Clean, Refined or Showcase. It writes
  its findings as one page, with a before and after comparison or a red-box
  screenshot for each visible finding, and opens that page in the review workspace
  for your comments.
- **Nothing is built until you approve.** Product code stays unchanged until you
  choose **Approve & finish** or say to build. It then builds one slice at a time.
- **A later round checks the last one.** It marks each earlier area as Landed,
  Landed but broken, or Moved.
- **New UI copy goes to ChatGPT.** While building, it runs `/vstack:proofread` on
  new UI copy without asking first. This needs Claude Code with Claude in Chrome.
  Elsewhere, or if the copy contains secrets or personal data, nothing is sent and
  the build continues. The review page itself is never sent.

**Fixed**

- **Your agent now hears when you approve.** Approve & finish often reached the
  agent as "the tab went away", so it did not know the design was signed off. This
  affected Claude Code and Grok.

## 6.9.1 — 2026-11-06

**Fixed**

- **The canvas stays where you were when the page changes height.** If you had
  scrolled down a long page and it then grew or shrank, the canvas jumped back to
  the top. It now keeps your place.

## 6.9.0 — 2026-11-06

**Added**

- **Remove AI-sounding phrasing from your agent's copy.** `/vstack:proofread`
  passes the copy your agent is writing to ChatGPT in your own browser, using your
  sign-in. It works on any user-facing copy, such as a document, UI text, release
  notes, or a message. Your agent then uses the reply as a reference and edits its
  own copy, keeping its facts, code, and URLs.
- **It runs without asking.** It uses the connected browser and edits with no
  approval step, so review the edit the way you review any other change. The run
  stops if the copy contains secrets or the browser is signed out of ChatGPT. Your
  clipboard is not touched.
- **Long copy works.** ChatGPT turns a long paste into an attachment, and the skill
  handles that route itself.

This needs Claude Code with Claude in Chrome, and a ChatGPT sign-in. On Codex and
Grok the skill says it is not available and stops. It uses a temporary chat, which
stays out of your history, but ChatGPT's page says a copy may be kept for up to 30
days. Run it only on copy you are willing to send to ChatGPT.

## 6.8.0 — 2026-08-11

**Added**

- **Hand a queued comment out to a subagent instead of waiting your turn.** Send
  three comments and the agent takes them one at a time, so the third waits for
  the first two. Each queued comment now carries a hand-out icon beside its ×,
  with a tooltip saying what it does. Press it and that comment is delivered
  straight away, beside the one the agent is already on, and a subagent applies
  it while the main round carries on. The comment is still closed and answered by
  the session you are talking to, so the review still speaks with one voice.
- **Parallel mode (Experimental): hand every comment out without clicking each
  one.** Tick *Parallel mode* in the workspace settings, and every comment
  already queued, and every comment you send after that, goes to a subagent. The agent reads the comments you sent together, groups related ones
  (same element, same component, same kind of change), and gives each group to
  one subagent. The setting is off by default and is remembered in your browser.
- The icon appears only where the coding agent can start a subagent. Claude Code
  and Grok can; Codex cannot, and there the control is hidden and every comment
  waits its turn as before.

**Changed**

- **Reviewing a running app no longer puts a project's whole test suite in front
  of every comment.** Comments are applied one at a time, so a full run per
  comment left you watching a progress bar through a suite that has nothing to
  say about a spacing or wording change. The agent now runs only what its change
  touches, and runs the full suite once your comments are all answered and
  nothing is queued. Reviewing a wireframe file is unaffected, since there is no
  code under it.

## 6.7.0 — 2026-08-10

**Fixed**

- **Comments no longer pile up undelivered when Codex stops polling.** Codex
  receives comments through a bounded wait that returns every 25 seconds, and
  the review continues only while the agent keeps calling it. Each wait now ends
  by printing the exact command that resumes it, so a loop that was about to be
  dropped names its own next step. Taking a comment prints the same line, since
  answering one comment is not the end of the review.
- **`unanswered` no longer reports all-clear over a review nobody is watching.**
  It now names a live review that has comments waiting with no watcher behind
  it, and gives the command that starts watching again. Codex runs this check
  before ending a turn, and it previously said nothing while a queue sat
  undelivered. Comments that were never delivered still do not block the end of
  a turn in Claude Code — they are reported, not gated.

## 6.6.0 — 2026-08-10

**Changed**

- **Review comments now reach the agent one at a time, in FIFO order.** New
  comments wait without interrupting the comment in progress. Asking a question
  releases the queue so the next ready comment can proceed; when the reviewer
  answers, that thread rejoins the queue at the time of the reply.
- The workspace shows exactly one comment as in progress. Later comments and
  answered threads say Queued, while questions still say that the agent is
  waiting on the reviewer.

## 6.5.0 — 2026-08-10

**Changed**

- **Codex now receives review rounds through bounded foreground waits.** Its
  terminal does not push a background process's output into an idle agent turn,
  so keeping a second persistent shell and polling its buffer could leave a
  comment marked as delivered before Codex had read it. Codex now runs a
  25-second `watch --next` call, repeats it on `IDLE`, and explicitly `claim`s a
  `REVIEW` offer. Until that claim succeeds, the comments remain queued.
- **Linked means a Codex consumer is still calling back.** Each bounded wait
  renews a short lease which bridges normal re-arms and expires when the turn
  stops. A leftover Node process can no longer keep the workspace falsely
  Linked. Claude Code and Grok keep their pushed stream watcher unchanged.
- Two Codex pulls may wait on the same review safely: both see one durable
  offer, and only the first claim records delivery. A push watcher remains
  exclusive and cannot be taken over by a project-wide pull.

## 6.4.1 — 2026-08-09

**Fixed**

- **A reply written with paragraph breaks arrives with them.** A shell leaves
  `\n` inside a quoted argument as two characters, so an agent's multi-paragraph
  answer reached the comment thread with `\n` showing as text. `reply --text`,
  `reply --option` and `publish --summary` now read `\n` as a line break. Write
  `\\n` when you mean the two characters.
- **A comment containing a double quote could break the page it was drawn on.**
  The workspace escaped `&`, `<` and `>` but not quotes, and most of what it
  builds is an HTML attribute — so a quote in your own words ended the attribute
  early and the rest of the note was read as markup. Quotes are now escaped
  everywhere the workspace writes them. The story map and the build board escape
  the ids they put in attributes for the same reason.
- **A save could change every object in the review server, not just its own
  comment.** A saved comment's fields were copied across by name, and a name
  like `__proto__` reaches the prototype rather than the object. Those names are
  now skipped.
- **The update check no longer keeps its cache in the shared temp directory.**
  On a machine with more than one account, anyone could create that file first
  and own what the check then wrote to it. It now lives in `~/.vstack/`, owned
  by the reader and readable only by them. The move resets what the old cache
  held, so a release you had already dismissed can ask once more.
- **A failed action shows what went wrong without the stack behind it.** The
  message is the part a reader can act on and is still shown in full.
- **A second session starting at the same moment cannot reset the other's
  counter.** The bridge's sequence file is now created in one step rather than
  checked and then written.
- The phase-preview comparison reads `</script >` and `</style >` as the closing
  tags they are, and strips nested comment markers until none are left.

## 6.4.0 — 2026-08-09

**Changed**

- **One place decides what the product looks like.** The palette now comes from
  `design/tokens.css`, the design guide's token source, instead of being decided
  in the shared shell. Every page — the review workspace, the story map, the
  spec tree, the build board, the chooser — picks up the guide's Cavalry brand:
  purple-cast neutrals in place of the cool greys, and the brand red at the step
  that holds its contrast on white. Nothing moved and nothing was renamed; only
  the colours changed.
- Dark is now part of that source rather than something the shell decided on its
  own, so both themes come from the same place.

## 6.3.0 — 2026-08-09

**Fixed**

- **Codex never told you a new version was out.** The update banner only knew
  how to recognise a Claude Code install, and the Codex profile had the check
  switched off, so a Codex copy stayed on whatever release it was installed at
  with nothing to say so. Codex installs are now recognised by the version
  directory Codex unpacks them into, and the banner shows the two commands that
  take the update:

  ```text
  codex plugin marketplace upgrade cavalry-collective
  codex plugin add vstack@cavalry-collective
  ```

  A running Codex thread keeps the copy it started with, so start a new thread
  after updating.
- An install sitting behind a symlinked path — `/var` and `/tmp` on macOS, or a
  home directory that has moved — was not recognised as an install, and got no
  banner.

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
