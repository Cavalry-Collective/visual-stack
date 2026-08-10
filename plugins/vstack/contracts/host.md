# Contract: Host

A **Host** is the coding-agent product that runs the skill (Claude Code, Codex, Grok
Build, …). The review engine does not call into a host. The *agent session*
running under a host fulfills these operations by using that host’s tools.

Every Host is described by a **profile** (`host-profiles/<id>.json`, schema
[`host.schema.json`](host.schema.json)). Servers load it; the workspace reads
`window.__VSTACK_HOST__`.

---

## Identity

| Field | Meaning |
| --- | --- |
| `id` | Stable key: `claude`, `codex`, `grok`, … — used as `VSTACK_HOST` / `--host` |
| `name` | Human label in UI (“Claude”, “Codex”, “Grok”) |

Two capability fields describe delivery semantics rather than UI:

| Field | Meaning |
| --- | --- |
| `capabilities.watch` | `stream` pushes events; `pull` uses bounded waits and explicit claims |
| `capabilities.turnGate` | Whether the Host can stop a turn from ending with a delivered round unanswered |

---

## Operations

These are the abstract operations the review skill (and later other skills)
require. Adapters map each op to concrete tools. Ops marked **required** must
work or the loop is not product-quality.

### `background(command)` — **required**

Start a process that **outlives the current agent turn**. Used for
`review-server.mjs serve …`.

- Must keep running after the turn ends.
- Must be stoppable via `stop`.
- Stdout/stderr should remain available for diagnosis.

### Watch delivery — **required**

A Host profile declares `capabilities.watch: stream | pull`, and its adapter
implements the matching operation.

#### `watch_stream(command)` — `stream`

Run a long-lived process whose **stdout is a line-delimited event stream**.
Each complete line is pushed to the agent as an event without polling or
re-arming. Used for:

```bash
node review-server.mjs watch --all --stream
```

- Process must not exit after the first event.
- Lines are UTF-8 text, one event per line (see [review-loop.md](review-loop.md)).
- **The agent must be able to act on a line as it arrives.**
- The engine tests that: the stream opens with a `HANDSHAKE` line naming a
  command the agent must run. The `watching` heartbeat starts once it is
  answered, and the watcher exits `3` if two minutes pass first. Answering
  proves a session is receiving the stream, which is the only claim the UI's
  **Linked** state is allowed to make.

#### `watch_next(command)` — `pull`

Run a bounded foreground command which returns one event or `IDLE` before the
Host tool's own yield limit:

```bash
node review-server.mjs watch --all --next --timeout 25
```

- `REVIEW` is a durable offer and prints a token-bearing `claim` command.
- The agent runs `claim` immediately; only a successful claim records delivery.
- `IDLE` means re-run the bounded wait while the review remains open.
- A short `listening` lease is renewed while each wait is active and expires if
  the Host stops calling. This, not a leftover process, proves **Linked**.
- Multiple pull consumers may see the same offer; `claim` serialises delivery.

### `stop(handle)` — **required**

Terminate a process started by `background` or `watch_stream`. A bounded
`watch_next` has no retained process after it returns.

### `run(command)` — **required**

Synchronous shell: `claim`, `publish`, `reply`, `share`, `check`, `status`, file edits’
supporting commands. Blocks until exit; agent reads exit code and stdout.

### `edit` — **required**

Change files under review (the HTML wireframe, or app source in live mode). Any
file-edit capability the host exposes.

### `share(file | capture) → url` — **optional**

Publish a self-contained wireframe (or a live-review capture) to a URL the
reviewer can send to someone else. Profile flag:

| `capabilities.share` | Meaning |
| --- | --- |
| `artifact` | Host can produce a public URL; skill uses `share` op |
| `copy` | No public publish; UI offers copy-to-clipboard only |
| `none` | Hide share affordances |

When the capability is not `artifact`, the agent must not pretend a link was
published. Offline bundle mode already degrades to copy (review-loop).

### `browser_capture` — **optional**

Navigate, screenshot, and run in-page JS (e.g. `harvest-reference.js`). Profile:
`capabilities.browser: true | false`. If false, the skill uses screenshots the
user provides or skips harvest.

---

## Runtime injection

When serving a workspace, the server:

1. Resolves Host via `--host <id>` or env `VSTACK_HOST` (default `claude`).
2. Loads `plugins/vstack/host-profiles/<id>.json`.
3. Injects into the page:

```html
<script>window.__VSTACK_HOST__ = { …profile… }</script>
```

The workspace uses `name` (and related strings) for chrome. It never hardcodes
a product name.

The server also checks whether a newer release exists, and hands the answer to
the page. `capabilities.updateDetect` says where an installed copy is found:

| `capabilities.updateDetect` | Where the installed version comes from |
| --- | --- |
| `claude-install` | Claude Code's record in `~/.claude/plugins/installed_plugins.json` |
| `codex-install` | The version directory Codex unpacked the copy into, under `~/.codex/plugins/cache/` |
| `none` | Nowhere. No check runs and no banner appears |

A Host that is not `none` must also give `install.commands`, because the banner
shows the reader how to take the update. A copy running from a clone matches no
install, and never produces a banner.

---

## Adapter documents

For each Host id, `skills/review/hosts/<id>.md` maps every required op (and
optional ones the Host supports) to that product’s tools, with exact invocation
examples. The core `SKILL.md` only names the ops above — never product tools.
