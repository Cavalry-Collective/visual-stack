# Host adapter: Grok Build

Implements [contracts/host.md](../../../contracts/host.md) for **Grok Build**
(and the Grok coding TUI). Profile: `plugins/vstack/host-profiles/grok.json`
(`id: grok`). That JSON is UI data only — the op-to-tool map is this file.

**Always** set the host so the workspace says “Grok”, not the default:

```bash
export VSTACK_HOST=grok
# or pass --host grok on serve (and prefer it on every command)
```

---

## Operation map

| Host op | Grok tool | How |
| --- | --- | --- |
| `background(cmd)` | `run_terminal_command` with `background: true` | `serve` must outlive the turn |
| `watch_stream(cmd)` | **`monitor`** tool, `persistent: true` | `watch --all --stream` — each stdout line is a chat event |
| `stop(handle)` | `kill_command_or_subagent` with the task id | After approve or when ending the review |
| `run(cmd)` | `run_terminal_command` (foreground) | `publish`, `reply`, `ack`, `status`, `unanswered` |
| `edit` | file edit tools (`search_replace`, `write`, …) | HTML wireframe or app source |
| `share(file)` | **Not available** as a public Artifact | Profile `capabilities.share: copy` — do not run the share-URL flow; UI hides “Publish a link” |
| `browser_capture` | Browser MCP / chrome-devtools when connected | Otherwise use user screenshots per skill §2 |

---

## Concrete start sequence

```bash
SKILL=<path to plugins/vstack/skills/review>
FILE=wireframes/example.html

node "$SKILL/assets/review-server.mjs" publish --file "$FILE" --label "Initial version" --host grok

# background: true
node "$SKILL/assets/review-server.mjs" serve --file "$FILE" --port 7788 --host grok

# monitor, persistent: true
node "$SKILL/assets/review-server.mjs" watch --all --stream

# then answer the HANDSHAKE line it prints, with run_terminal_command
node "$SKILL/assets/review-server.mjs" ack --all --token <token from that line>
```

The `HANDSHAKE` line arrives as soon as `monitor` has it. Answer it with `ack`,
and the watcher is live from then on.

Tell the user **http://localhost:7788/** (or `/__review/` for live `--app`).

---

## Events → agent turns

When `monitor` delivers a line:

| Line prefix | Action (same as [review-loop.md](../../../contracts/review-loop.md)) |
| --- | --- |
| `HANDSHAKE` | Run the `ack` command it prints, immediately — the watcher goes live once you do |
| `REVIEW` | read the `brief.md` it names, apply it, then `publish --close` / `reply` — never delete protocol files |
| `SHARE` | Host has no artifact share — tell the user to copy/export the HTML, or use `bundle-artifact.mjs` for a file they can send |
| `APPROVED` | Confirm; offer next pipeline stage if applicable |
| `CLOSED` | Note the review ended |

Run `unanswered --all` before you end a turn, and settle whatever it names.
Grok cannot gate the end of a turn, so rule 14 of
[review-loop.md](../../../contracts/review-loop.md) is yours to keep.

---

## Install / discovery

Grok has no plugin marketplace, so it discovers this the way it discovers any
skill: a directory under `<grok-home>/skills/` or `<project>/.grok/skills/`.
Clone the visual-stack repo somewhere stable, then write a thin entry skill in
the project you want to review — it sets the host and reads this tree, so there
is only one copy of the engine:

```markdown
---
name: review
description: >
  Build a UI wireframe and review it — or an app that is already running —
  in an interactive workspace, commenting directly on the screen.
---

1. `export VSTACK_HOST=grok` for every review-server process this session, and
   pass `--host grok` on `serve` so the workspace UI says Grok.
2. Read `<visual-stack>/plugins/vstack/skills/review/hosts/grok.md` — the op map.
3. Read `<visual-stack>/plugins/vstack/skills/review/SKILL.md` and follow it.
4. `$SKILL` for CLI commands is `<visual-stack>/plugins/vstack/skills/review`.

Do not use Claude Code tool names (Monitor, Artifact, TaskStop,
run_in_background). Use only the ops mapped in `hosts/grok.md`.
```

Copying `plugins/vstack/skills/review` outright works too, but only if `hosts/`,
`assets/`, and the relative paths up into `lib/` come with it — and then updates
have to be copied again.

Update banners are off for Grok (`updateDetect: none`); pull the repo to update.

---

## Notes

- Do not invent a public share URL. If they need a file to send, bundle or
  attach the HTML; optionally run `bundle-artifact.mjs` for a self-contained
  review copy (comments stay local / clipboard).
- Prefer one persistent `monitor` for `--all` rather than re-arming one-shot
  `watch` every round.
