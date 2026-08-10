# Host adapter: Codex

Implements [contracts/host.md](../../../contracts/host.md) for **Codex**.
Profile: `plugins/vstack/host-profiles/codex.json` (`id: codex`). That JSON is
UI data only — the op-to-tool map is this file.

Pass the host explicitly when starting a server. Codex shell calls do not
necessarily share exported environment variables:

```bash
node "$SKILL/assets/review-server.mjs" serve --file "$FILE" --port 7788 --host codex
```

## Operation map

| Host op | Codex tool | How |
| --- | --- | --- |
| `background(cmd)` | persistent shell execution (`exec_command`) | Start with a short yield and retain the returned session id. The review server must stay alive. |
| `watch_next(cmd)` | foreground `exec_command` | Run `watch --all --next --timeout 25` with a 30-second tool yield. It completes inside the call with one event or `IDLE`; call it again while reviews remain open. |
| `stop(handle)` | `write_stdin` | Send Ctrl-C (`\u0003`) to the retained review-server session. The bounded watcher leaves no process to stop. |
| `run(cmd)` | foreground `exec_command` | Use for `claim`, `publish`, `reply`, `share`, `status`, and `unanswered`. |
| `edit` | `apply_patch` | Change the wireframe or application source without overwriting unrelated work. |
| `share(file)` | no generic public Artifact publisher | Profile uses `capabilities.share: copy`; offer the HTML file or an offline bundle instead of inventing a URL. |
| `browser_capture` | Codex Browser controls, when installed | Navigate, resize, screenshot, and run `harvest-reference.js`. If Browser is unavailable, use screenshots supplied by the user. |

## Concrete start sequence

```bash
SKILL=<path to plugins/vstack/skills/review>
FILE=wireframes/example.html

node "$SKILL/assets/review-server.mjs" publish --file "$FILE" --label "Initial version"

# persistent exec session; retain its session id
node "$SKILL/assets/review-server.mjs" serve --file "$FILE" --port 7788 --host codex

# foreground exec_command, yield 30s; it returns within 25s
node "$SKILL/assets/review-server.mjs" watch --all --next --timeout 25

# REVIEW prints this exact command; run it before reading brief.md
node "$SKILL/assets/review-server.mjs" claim --file <page.html> --token <token>
```

Tell the user **http://localhost:7788/** (or `/__review/` for live `--app`).

## Events and turn lifetime

Codex uses bounded pull delivery because output written by a background terminal
is not proof that the current agent turn read it:

1. Run `watch --all --next --timeout 25` as a foreground `exec_command` with a
   30-second yield. Do not retain a watcher session id.
2. `IDLE` means call the same command again. The pull lease keeps the workspace
   Linked between prompt re-arms and expires if this turn stops calling.
3. `REVIEW` is an offer, not a delivery. Run the exact `CLAIM` command printed
   immediately. Only a successful claim marks the comment delivered and writes
   `brief.md`; then read the brief and follow the core loop.
4. On `SHARE`, `APPROVED`, or `CLOSED`, follow the core skill and review-loop contract.
5. Run `unanswered --all` before you end a turn, and settle whatever it names.
   Codex cannot gate the end of a turn, so rule 14 of
   [review-loop.md](../../../contracts/review-loop.md) is yours to keep.
6. Resume bounded waits after each publish. Do not send the final response
   while the review is still active; keep the Codex turn open until approval,
   closure, or an explicit request from the user to stop.

Two Codex sessions may wait at once. They receive the same durable offer and
`claim` serialises delivery; the loser is told to wait again. A Claude/Grok push
watcher still has exclusive ownership, so a Codex pull does not steal its review.

## Share

Codex has no generic Artifact-equivalent for this local review loop. The
workspace therefore hides the public-link request. If the user needs something
portable, attach the wireframe HTML or run `assets/bundle-artifact.mjs` to make
an offline review copy. Do not claim that either is a hosted public URL.

## Install and discovery

The plugin manifest at `plugins/vstack/.codex-plugin/plugin.json` exposes the
Visual Stack skills to Codex; this wireframe workflow is the one with a Codex
host adapter. Install the repository marketplace, then install the plugin:

```text
codex plugin marketplace add Cavalry-Collective/visual-stack
codex plugin add vstack@cavalry-collective
```

Start a new Codex thread and invoke **`$vstack:review`**, or describe a wireframe or
UI-review task and let the skill trigger implicitly.

Update detection uses the version directory Codex unpacked this copy into
(`capabilities.updateDetect: codex-install`), so the workspace says when a newer
release exists. Update with the two commands the banner shows:

```text
codex plugin marketplace upgrade cavalry-collective
codex plugin add vstack@cavalry-collective
```

A running Codex thread keeps the copy it started with. Start a new thread after
updating.
