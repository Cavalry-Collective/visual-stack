# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Visual Stack — a coding-agent plugin for interactive wireframing and UI review.
The user comments directly on a wireframe (or a running app) in a browser
workspace; the agent applies the feedback and publishes the next version into
the same workspace. The repo is a Claude Code plugin marketplace
(`.claude-plugin/marketplace.json`) with one plugin, `plugins/vstack/`, which
also ships a Codex manifest (`.codex-plugin/`) and a Grok host adapter
(`skills/review/hosts/grok.md`).

**This repo is the thing people install; nothing is installed into it.** No
`.grok/skills/`, no `.claude/skills/`, no vendored copy of our own plugin — a
host that discovers skills from a project directory gets instructions in its
host adapter, not a checked-in skill directory that then has to be kept in sync.

`.claude/commands/` is the one exception, and it holds maintainer tooling only:
commands for working *on* this repo, which ship to nobody and mirror no part of
the plugin. `/ship` is the only one. A command there states no rule of its own —
it points at the section of this file that owns the rule.

Plain Node ≥ 18 ES modules, standard library only. There is no package.json,
build step, bundler, or linter. (`node_modules/` at the root appears only when
recording the README demo, which installs playwright-core.)

## Commands

Tests are standalone Node scripts — run them directly, one file per suite:

```bash
node plugins/vstack/skills/review/tests/review-lifecycle.mjs   # end-to-end review server round-trip
node plugins/vstack/skills/review/tests/host-profiles.mjs      # host profiles conform to host.schema.json
node plugins/vstack/skills/review/tests/workdir.mjs            # .vstack/local working-dir resolution
node plugins/vstack/skills/review/tests/round-gate.mjs         # `unanswered` and the Stop hook that runs it
```

The Gherkin end-to-end suite lives in `e2e/` — the one directory with a
`package.json`, kept outside `plugins/` so the plugin itself stays
dependency-free. It drives the real review server and CLI; a mock agent
(`e2e/support/mock-agent.mjs`) plays the agent role, so no model or API key is
involved. CI runs it under both hosts.

```bash
cd e2e && npm ci
npx playwright install chromium     # once, for the @browser scenarios
npx cucumber-js                     # VSTACK_HOST=claude (default)
VSTACK_HOST=codex npx cucumber-js   # the same suite under the Codex profile
```

The shared UI shell is stamped into pages, not linked (see below):

```bash
node plugins/vstack/lib/build-shell.mjs stamp    # write lib/shell/ into every page
node plugins/vstack/lib/build-shell.mjs check    # exit 1 if any page has drifted
```

The manifests are validated by the same tool the community-marketplace review
pipeline runs:

```bash
claude plugin validate . --strict                # .claude-plugin/marketplace.json
claude plugin validate ./plugins/vstack --strict # the plugin manifest
```

`.github/workflows/ci.yml` runs all of the above on every pull request.

The security scans run in `.github/workflows/security.yml`, and a merge is
blocked until every one of them passes. Two of them run locally:

```bash
gitleaks git --no-banner --redact --verbose   # secrets, over the full history
uvx zizmor@1.29.0 .github/workflows/          # workflow audit
```

SonarQube Cloud analyses the repository on its own and reports a quality gate
on the pull request. It is configured by `.sonarcloud.properties`, which it
reads from `main` only, so a change there takes effect after the merge.

`SECURITY.md` owns what each gate enforces, the rule that a finding is fixed
rather than silenced, and the rule that every action is pinned by commit SHA
with its version in a trailing comment. Adding a step that uses an action means
resolving that SHA with
`gh api repos/<owner>/<action>/commits/<tag> --jq .sha`. Declare each job's
`permissions` on the job, never at workflow level, so a new job cannot inherit
one it does not need.

CI rehearses the install, and you can run the same thing locally.
`CLAUDE_CONFIG_DIR` keeps it out of the real config: without it, a local-path
marketplace is written to user settings and shadows the published
`cavalry-collective` until it is removed. The source must be `./`, not `.`.

```bash
SANDBOX=$(mktemp -d)
CLAUDE_CONFIG_DIR=$SANDBOX/.claude claude plugin marketplace add ./
CLAUDE_CONFIG_DIR=$SANDBOX/.claude claude plugin install vstack@cavalry-collective
CLAUDE_CONFIG_DIR=$SANDBOX/.claude claude plugin details vstack   # what a user sees
rm -rf $SANDBOX
```

Nothing above runs a review end to end. For that, load the plugin from disk and
drive the skill in a real project:

```bash
claude --plugin-dir ./plugins/vstack
```

## Architecture

### Contracts / engine / adapters / profiles

The layering rule that everything else follows (`plugins/vstack/contracts/README.md`):

- **Contracts** (`plugins/vstack/contracts/`) define what a coding-agent host
  must provide (`host.md`), the review protocol (`review-loop.md`), and the
  bridge protocol (`bridge-loop.md`). The engine and skills depend only on these.
- **The engine speaks contracts.** `review-server.mjs`, the workspace pages, and
  the shared shell never name a product (Claude, Codex, Grok) except as data
  from a Host profile.
- **Adapters speak hosts.** Only `skills/review/hosts/*.md` may mention
  host-specific tools (Monitor, Artifact, etc.). A SKILL.md references Host ops
  (`background`, `watch_stream`, `share`, …); the adapter maps them to tools.
- **Profiles are data.** `host-profiles/<id>.json` carries UI labels, install steps, and
  capability flags; servers inject it as `window.__VSTACK_HOST__`, selected by
  `--host` / `VSTACK_HOST` (default `claude`). Loaded via `lib/host.mjs`.
- **On-disk roles are stable:** review threads use `by: "agent" | "reviewer"`.
  Older files may say `"claude"`; readers treat that as `"agent"`.
- **Hooks are adapter surface.** `plugins/vstack/hooks/hooks.json` is Claude
  Code's only entry point into the plugin, and no other host reads it. It
  registers one Stop hook, `hooks/round-gate.mjs`, which blocks the end of a
  turn while a review comment the agent took delivery of is still unanswered.
  The hook decides nothing itself: `review-server.mjs unanswered` owns what an
  unfinished round is, so every host gets the same answer by running it. Rule 14
  of `contracts/review-loop.md` is what it enforces.

### Two engines, one live-link protocol

- `skills/review/assets/review-server.mjs` — the wireframe review loop. Serves
  a self-contained HTML page inside the workspace, or reverse-proxies a running
  app (`--app`) so the workspace shares an origin with what it annotates (that
  origin-sharing is why comments can attach to elements, not coordinates). CLI
  subcommands (`serve`, `watch`, `publish`, `reply`, `ack`, `share`, `status`,
  `unanswered`, `reset`) drive the protocol; sentinels and round records live on disk.
- `lib/json-bridge.mjs` — the live link for JSON-document pages (user-story-map,
  plus the experimental spec and phase-build tools): the page POSTs saves and
  bumps a seq counter the agent's watcher wakes on; agent edits are pushed back
  over SSE.

Both share `lib/live-link.mjs`: a `watching` heartbeat file that says an agent
session is listening, atomic write-then-rename, and one protocol-wide staleness
constant — so the invariants can't drift between engines. Servers bind to
`127.0.0.1` only and close themselves when the browser tab goes away
(SSE idle timeout).

### Self-contained pages and the stamped shell

Every page (workspace, spec tree, story map, build board…) must work three
ways: served over http, opened off disk, and inlined into an Artifact under a
CSP that blocks all external requests. So nothing is linked at runtime — the
shared shell (`lib/shell/`: tokens, top bar, scrubber, `window.VSShell` /
`window.VSScrub`) is **copied into each page** by `lib/build-shell.mjs` between
`vstack:shell` markers. Edit `lib/shell/`, run `stamp`, commit both. Never
hand-edit a stamped region; page-specific controls go in `vstack:slot` blocks,
which survive stamping. New pages register in the `PAGES` list in
`build-shell.mjs`.

### On-disk state

Every tool writes per-machine state under `<root>/.vstack/local/<tool>/`
(gitignored via `**/.vstack/local/`); the rest of `.vstack/` (pipeline.json,
specs/, build/) is the pipeline and belongs in the repo. `lib/workdir.mjs`
resolves the directory — use it rather than joining paths by hand.

**Renaming a tool does not rename the directory it already filled.** `workdir.mjs`
keeps a `LEGACY` map of a tool's former directory names; `subjectDir()` reads a
subject from the first directory that holds it and creates new ones under the
current name, and `toolNames()` gives every name to callers that enumerate. Add
to `LEGACY` when you rename a tool — never migrate a user's rounds behind their
back. Review's rounds sat in `local/wireframe/` before the tool was renamed.

### Skills

Each skill is `plugins/vstack/skills/<name>/SKILL.md` plus `assets/` (the pages
and servers it runs). `review` is the primary tool and `user-story-map` ships
alongside it; `wireframe` is a compatibility entry that reads `review/SKILL.md`
and nothing else — it is what `review` used to be called. Engine
assets (`workspace.html`,
`review-server.mjs`, `bundle-artifact.mjs`) are never edited to fit a project —
only the page under review is.

`plugins/vstack/experimental/` holds the earlier project-planning tools (spec,
start, phase-build, phase-preview) and the retired `/vstack:go` alias in the
same `<name>/SKILL.md + assets/` shape. They are parked outside `skills/` on
purpose so no host discovers them as installable skills; their pages still
carry the stamped shell and are kept from drifting by `build-shell.mjs`.
Moving one back under `skills/` is the whole act of re-releasing it.

## Distribution and releases

This repo is what a stranger installs, so its public metadata is part of the
product. `claude plugin validate --strict` must pass on both manifests before
any change ships, because the community-marketplace review pipeline runs the
same check.

### Two host manifests, one identity

`plugins/vstack/.claude-plugin/plugin.json` and
`plugins/vstack/.codex-plugin/plugin.json` describe the same plugin to two
hosts, and `.claude-plugin/marketplace.json` repeats the Claude entry.

- Change one manifest, change all three in the same commit.
- `version`, `author`, `homepage`, `repository`, `license`, and `keywords` are
  identical across them. Only the description's host name and the Codex
  `interface` block differ.
- Descriptions take their wording from `README.md`. The README is where the
  product's voice is decided; a manifest quotes it rather than inventing a
  second one.
- Keywords cover what someone would type to find this, not what it is built
  from. Do not add a keyword the description cannot back up.
- CI fails when the two host manifests declare different versions.

### Versioning

`version` is declared, so it is what a host compares against to decide an update
exists. **Pushing commits without bumping it ships nothing to anyone.**

- Bump `version` in both host manifests, and add the `CHANGELOG.md` entry, in
  the pull request that changes the plugin — not in a release commit afterwards.
  `.github/scripts/check-version.mjs` fails the PR when either is missing.
- Never tag by hand. `.github/workflows/release.yml` tags `main` and publishes
  the release from what the merge already declares.
- MAJOR for a breaking change to a skill name, an on-disk path, or a protocol.
  MINOR for new behaviour. PATCH for a fix.
- Orphaning a user's in-flight state is MAJOR, and it needs a `LEGACY` entry in
  `lib/workdir.mjs` rather than a migration.
- `lib/update-check.mjs` mirrors the host's own update decision. It reads the
  declared `version` first and falls back to the install SHA only for a copy
  installed before a version existed. Changing how the version is declared means
  changing that file.

### Releasing

Merging to `main` is the release: this repository is what a user installs, so
the code is live the moment it lands. The version and the changelog entry
therefore belong in the pull request that changes the plugin, and a release is
not a separate piece of work.

When a pull request touches `plugins/`, include in the same branch:

1. `version` raised to the same value in both host manifests, by the semver rule
   above.
2. The matching `CHANGELOG.md` entry, newest first, breaking changes called out.
   This is published verbatim as the release notes, so write it for a user.

The `Plugin changes ship a version` check fails the PR without both. Nothing
downstream can catch this: a merge that leaves the version alone publishes the
code and tells nobody, and the only repair is a second release.

After the merge, `.github/workflows/release.yml` tags `main` as `vX.Y.Z` and
publishes the GitHub release. It keys on whether that version is already tagged,
so it is safe to re-run and does nothing on a merge that changed no version.

Never tag by hand, never publish a GitHub release by hand, and never bump a
version on `main` outside a pull request. A wrong version is fixed by the next
release.

When the user asks about a release that has already happened, read the state
rather than doing anything. `gh release list --limit 3` and `git log --oneline
origin/main -3` say whether it published. A version on `main` with no tag means
the Release workflow failed, and `gh run list --workflow Release --limit 3` says
why. Nothing changed under `plugins/` means there is nothing to ship, which is an
answer rather than a reason to invent a version.

### Shipping a change when asked

`/ship` runs this. It is also what to do whenever the user says to ship, land,
release, or merge the work on the current branch. The user asking for it is
standing approval for the pull request and the merge, so do not ask again.

Everything from step 2 is public.

1. **Check the branch carries what it must.** Run the tests, the shell check and
   both validate commands locally first — a red check you could have caught is
   wasted round-trips. If anything under `plugins/` changed, the version and the
   `CHANGELOG.md` entry go in now, per *Releasing* above. Say which version you
   picked and why, in one line.
2. **Open the pull request.** Branch off `main` if the work is not already on
   one. The title is the sentence a reader sees in `git log`; the body says what
   changed and how it was driven end to end.
3. **Watch both channels until they settle.**
   - `gh pr checks <number> --watch`. Every required check must pass.
   - `gh pr view <number> --comments` and `gh api
     repos/Cavalry-Collective/visual-stack/pulls/<number>/comments` for review
     threads. SonarQube and the review bots comment here rather than only failing
     a check, so a green check list is not the whole picture.
4. **Fix on the branch and push.** Then watch again. A security finding is fixed,
   never silenced or ignored. Answer a review comment that you are not acting on,
   rather than leaving it unanswered.
5. **Merge when everything is green.** Squash.
6. **Confirm what it published.** A version bump tags `main` and publishes the
   release within about a minute. Give the user the release URL. A merge that
   carried no version bump publishes nothing, which is correct — say so.

Stop and report instead of working around a problem:

- The same check fails twice with the same error after your fix. Name what you
  tried.
- A failure that is not yours: a service outage, a rate limit, a check that
  passes on `main`.
- A review comment that asks for a decision the user has not made.
- The ruleset rejects the merge.

Never merge with `--admin`, never bypass a ruleset, and never turn a check off to
get past it.

### Contributor-facing files

`CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, and this file state the
same rules to three audiences. A rule is owned by one of them and referenced
from the others. When a rule here changes and a contributor has to follow it,
update the PR checklist in the same commit.

## Coding standards

Keep cross-cutting concerns in shared modules, and keep `lib/` pure.
(Libraries-over-hand-rolling is a Principle below.)

- **Configuration.** All runtime config is read from the environment in one
  place and validated at startup against a declared schema, so a missing or
  malformed value fails fast with a clear, named error rather than misbehaving
  mid-request. No inner layer reads config directly — it is passed inward as
  values.

### Readability and Naming

Readable code is a review priority. A reviewer should understand intent from
names alone.

- Names are precise and state business meaning, not mechanics.
- No abbreviations unless standard in the domain or codebase. No misleading
  names. No single-letter variables outside trivial loop counters and
  conventional math.

#### Comments

- Comments explain **why** — the constraint, tradeoff, or external quirk behind
  the code — never what.
- Delete any comment that repeats what the code says.
- Notes to the reviewer ("fixed X here") go in the commit message, not in
  comments.

## Documentation style

Applies to every Markdown document in this repo.

- Write plain business English. Say it the way you would explain it to a
  colleague.
- Lead with the purpose. Open a document or section with why it exists, then
  drill into detail. Edge cases and notes go at the end.
- One idea per sentence. One rule per bullet. Prefer bullets and numbered lists
  over paragraphs. Use tables for reference material (keys, codes, bounds).
- Make a person or the system the subject.
- No slogans, no compressed abstractions. Contrast is fine when it prevents a
  mistake ("return 404, not 403"); drop it when it is only for effect
  ("assertions, not hopes").
- No em-dash chains or nested parentheticals. If a sentence needs more than one
  qualifier, split it.
- State rules imperatively. Rationale and rejected alternatives live in the
  document's designated notes/decisions section, never inline with the rule.
- No document history or meta-narration. Don't describe how the document came to
  be, what moved where, or what another file deliberately omits.
- State a rule once, in the document that owns it. Link to it from everywhere
  else.
- Exception: verbatim contract strings and copy-paste command blocks are never
  reworded for style.

## Principles (must follow)

Load-bearing engineering rules; honor them on every change. They are stack- and
tooling-agnostic.

- **Think before coding.** Don't assume, don't hide confusion, surface
  tradeoffs. State your assumptions and ask when uncertain; present multiple
  interpretations rather than silently picking one; suggest simpler alternatives
  and respectfully push back when warranted; stop and name what's confusing
  rather than proceeding on unclear requirements.
- **Simplicity first / YAGNI.** Write the minimum code that solves the problem.
  No unrequested features, no abstractions for single-use code, no
  configurability or error handling for cases that can't occur. "We might want
  it later" is not a reason. If 200 lines could be 50, rewrite.
- **Change the right place, surgically.** First identify *where* a change
  belongs — the correct layer and boundary — and make it there; don't patch
  wherever is convenient. Then touch only what you must: match the surrounding
  style and conventions (error handling, logging, validation), don't reformat or
  refactor unrelated working code, flag unrelated dead code without removing it,
  and remove only the imports/variables your own change orphaned.
- **Goal-driven execution.** Define success criteria and loop until verified.
  Turn requests into measurable objectives with a brief plan and a verification
  step per phase, so each phase can iterate to a clear success marker. Verified
  means observed, not inferred: before calling a change done, run it and state
  the evidence you saw.
- **Don't reinvent existing solutions.** Use established libraries and project
  utilities for dates, money, validation, retry, pagination, parsing, and
  formatting rather than hand-rolling them — especially date/timezone math.
  Don't duplicate existing abstractions or wrap a library without a clear
  reason. Before adding a new dependency, confirm an existing dependency or
  shared util doesn't already cover it, and prefer well-maintained,
  widely-used, permissively-licensed packages. A trivial, stable one-liner
  doesn't earn a dependency — but dates, money, timezones, auth, and crypto
  always do; never hand-roll those.
- **Don't overfit to the immediate request.** Solve the general problem, not
  just the demonstrated case. Avoid hardcoding strings, IDs, statuses, roles, or
  regions; handle the empty, invalid, duplicate, retry, timeout, and permission
  cases, not only the happy path; and write tests that assert behavior rather
  than mirror the implementation.
- **Keep implementations clean, not mechanical.** No noisy logs, no broad
  `try/catch` that hides errors, no unused parameters or dead branches, no
  defensive code without a clear failure model. (Comment rules: *Readability and
  Naming*.)

## Demo recordings (README GIFs)

Use these dimensions for every demo recording — they were tuned so the text
reads clearly in the README:

- **Browser viewport 920 × 760**, and export the GIF at native resolution —
  never downscale the frames.
- **Review the demo page at phone width** (the workspace's 390px size) with the
  canvas zoom locked at 100%. The workspace refits zoom on every version load
  (size switch, Review changes, timeline scrub), so a recording script must
  pin it — set zoom to 1 and no-op the refit for the session.
- Keep the subject app trivially simple (the todo list works well) so the
  before/after change is obvious at a glance.
- Keep it snappy: fast typing, short holds, ~1.4× speedup at assembly, and
  clamp idle gaps (e.g. the round-trip wait) to ~0.5s.
- Target: ~12 seconds, under 1 MB, saved to `docs/assets/wireframe-demo.gif`.

Recordings are scripted — headless Chrome via playwright-core driving the real
review server end to end (publish v1, comment, send, claim, publish v2), with
frames captured as JPEGs and assembled with ffmpeg (two-pass palette).
