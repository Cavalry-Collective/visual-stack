# Contract: Review loop

The local protocol between (1) the **review engine** (`review-server.mjs` +
workspace), (2) the **agent session**, and (3) the **reviewer** in the browser.

Host-independent: any Host that fulfills [host.md](host.md) can drive this loop.

One list of comments. Each is open or closed. The agent is the only one who
closes. Everything the workspace shows is derived from that list.

---

## Participants

| Role | Responsibility |
| --- | --- |
| **Engine** | Serves workspace, keeps the comment list, freezes versions, emits events |
| **Agent** | Takes delivery, applies comments, replies, closes, publishes versions |
| **Reviewer** | Comments in the browser; Send / Approve / Share |

---

## Subject under review

| Mode | Identity | What the agent changes |
| --- | --- | --- |
| **File** | `--file <page.html>` | That HTML file |
| **Live** | `--app <url>` + `--name <slug>` | App source (or notes for a third-party site) |

---

## The comment

`comments.json` is the whole truth for a review. One list, not one per version.

| Field | Meaning |
| --- | --- |
| `id` | Stable, shared with the workspace |
| `note` | What the reviewer asked for. Frozen once `sentAt` is set |
| `kind` | `comment` · `area` · `general` · `move` · `strike` |
| `anchor` | Element identity (tag, id, cls, role, label, text, region, sel) |
| `move` / `strike` / `covers` | Payload for the drawn marks |
| `route` | Live only — the app path it was made on |
| `size` | Screen size it was made at |
| `seenAt` | Version on screen when it was written. Display only |
| `state` | `open` · `closed` |
| `closedAt` | When the agent closed it |
| `replies` | `{ by, text, at }[]`, append-only |
| `sentAt` | The reviewer let go of it. Null means it is still a draft |
| `deliveredAt` | The agent was last handed it. Null means it is still queued here |

Those two timestamps carry the whole of a comment's progress:

| State | `sentAt` | `deliveredAt` | Editable | Withdrawable |
| --- | --- | --- | --- | --- |
| Being written | — | — | yes | yes, outright |
| Queued | set | — | no | yes |
| With the agent | set | set | no | no — reply asking for it back |

---

## Who may do what

**Reviewer** — three verbs:

- Add a comment.
- Reply to a comment. A reply to a closed comment reopens it.
- Withdraw a comment, while `deliveredAt` is null.

A reviewer never closes a comment. Withdrawing something already handed over is
a reply saying so; the agent undoes what it has to and closes it.

**Agent** — three verbs:

- Take delivery of the open comments (the tick).
- Reply to a comment. This never changes its state.
- Close comments, and optionally snapshot a version.

---

## Thread roles (on disk)

```ts
type ReplyBy = "agent" | "reviewer"
// Legacy reads: "claude" MUST be treated as "agent"
```

Writers always use `"agent"`. Readers accept both `"agent"` and `"claude"`.

CSS/UI may use class `agent`; class `claude` remains a synonym for old markup.

---

## On-disk store

Beside the file: `<dir>/.vstack/local/review/<name>/`
Live (no file): `<cwd>/.vstack/local/review/<name>/`

`review/` is where a store is **created**. An implementation must also **read**
`<dir>/.vstack/local/wireframe/<name>/`, which is where stores made before this
tool was renamed still are — first directory holding the subject wins, and a
subject present in both is read from `review/`.

| Path | Role |
| --- | --- |
| `state.json` | `{ name, version, file? \| app?, start? }` |
| `comments.json` | Every comment for this review |
| `brief.md` | The open comments, rewritten on every delivery |
| `versions/v<n>.html` | Frozen file, or the DOM capture for a live app |
| `versions/v<n>.meta.json` | `{ n, label, date }` |
| `reviews/v<n>/` | Only ever read: where a store filled by an older version keeps its comments |
| `handshake` | A stream watcher waiting to be told its events are being read |
| `approved` | Sentinel: design signed off; engine shutting down |
| `share` | Sentinel: reviewer wants a shareable link |
| `url` | Present only while `serve` is running |
| `watching` | Heartbeat while Host op `watch_stream` is active |

`serve` also records the store it is serving under the directory it was run
from: `<cwd>/.vstack/local/review/.serving/<key>`, one file per live review.
`watch --all` finds a review by walking the directory it was run from **and** by
following those pointers. A pointer whose store has no `url` is stale, and the
reader deletes it.

**Reading a store from an older version.** When `comments.json` is absent, build
it from the `reviews/v<n>/` directories: the newest copy of each id wins,
`addressed` and a reviewer's dismissal both become `closed`, and anything
already sent counts as delivered. Those files are left where they are. Nothing
is migrated behind the user's back.

---

## CLI surface

All commands: `node review-server.mjs <cmd> …`
Host selection: `--host <id>` or `VSTACK_HOST=<id>` (affects UI injection only).

| Command | Contract |
| --- | --- |
| `serve --file …` / `serve --app …` | Long-lived via Host `background`. Binds `127.0.0.1` |
| `watch [--all] [--file …] [--stream]` | Take delivery. Blocks until the reviewer has said something new |
| `ack --file/name … --token <token>` | Answer a stream watcher's handshake. Only this arms the `watching` heartbeat |
| `publish --file/name … [--close ids] [--label …]` | Close comments, snapshot a version, or both |
| `reply --file/name … --comment <id> --text "…"` | Append `{ by: "agent", text, at }` |
| `share --file/name … --url <url>` | Record public URL; clear the `share` sentinel |
| `status --file/name …` | Human/debug snapshot |
| `check [--all] [--file/name …]` | What the agent still owes. Exits 1 when a delivered comment is unanswered |

---

## Stream events

One line of stdout per event (from `watch --stream`):

| Prefix | Meaning | Agent action |
| --- | --- | --- |
| `WATCHING` | Stream armed | — |
| `HANDSHAKE` | The watcher asking whether anyone receives it | Run the `ack` command it prints, immediately |
| `LINKED` | The handshake was answered and at least one review is covered | — |
| `UNLINKED` | The handshake was answered and no review turned up to cover | Start it again with `--file` if a review is running elsewhere |
| `UNWIRED` | The handshake went unanswered; the watcher exits `3` | Start it again via `watch_stream` |
| `REVIEW` | Comments have been handed over; names how many and the brief | Read `brief.md`, apply it, `publish --close` / `reply` |
| `SHARE` | Link requested | Host `share` if capable; then `share --url` |
| `APPROVED` | Sign-off; server exiting | Confirm; next pipeline stage as skill says |
| `OPENED` | Another live store joined `--all` | — |
| `CLOSED` | Tab/store gone | Drop; exit when none left |

A reply raises no event of its own: it is the same comment coming round again
with more said on it.

---

## The loop

```
serve (background) + watch_stream
        │
        ▼
reviewer comments ──Send──► comments.json
        │                         │
        │                    REVIEW event  ──► brief.md (delivery recorded)
        │                         ▼
        │              agent: apply · reply/close · publish
        │                         │
        │◄──── version ready ─────┘
        │
 Approve ──► approved ──► APPROVED + server exit
  Share ──► share ──► SHARE ──► share --url
```

Rules:

1. Only `publish --close` closes a comment. The reviewer has no resolve.
2. A tick hands over **every** open comment, not only the new ones, and marks which are new since the last delivery.
3. Whatever the agent does not close stays open and comes back on the next tick. There is no coverage to satisfy.
4. **Nothing can refuse a close.** An agent that has taken delivery can always finish, whatever the reviewer did meanwhile.
5. Closing what is already closed is a no-op, so a retried command is safe.
6. A comment's words are frozen when the reviewer sends it. The engine keeps the stored note whatever a client saves afterwards.
7. A reply is append-only, from either role. Two copies of a thread merge to the union of both.
8. A reviewer's reply to a closed comment reopens it. An agent's reply never changes state.
9. A comment may be withdrawn until it has been delivered. After that, withdrawal is a reply asking for it back.
10. A version is a snapshot to look at. It records no comments, and no comment records a version.
11. One `watch_stream` per session is enough with `--all`.
12. Presence is proven. A stream watcher writes its `watching` heartbeat from the moment its handshake is answered, so **Linked** means a session is receiving the stream. Default window 120 s (`--handshake-timeout <seconds>`).
13. Presence is per review, and per watcher. A watcher heartbeats only the stores it covers, and goes live only on an answer carrying its own token.
14. An agent that took delivery answers. A comment it was handed is answered by closing it or by replying to it. Neither is a round that stopped halfway, because no tick will raise that comment again until the reviewer writes. `check` names them, and exits 1 while any remain.
15. A delivered comment goes back to the queue when nothing is listening. That is the way out of a round whose agent session died: those comments are not `unseen`, so no new watcher would ever hand them over. `deliveredAt` is cleared and the comment is Queued again. The engine refuses this while a `watching` heartbeat is fresh, because then an agent still holds it and rule 9 applies instead.

Rule 14 is an obligation on the agent, not a refusal by the engine. Rule 3
still holds: `publish` closes exactly what it names and accepts everything else
being left open. A Host that can gate the end of a turn is where the obligation
is enforced — see the Stop hook in `plugins/vstack/hooks/`. A Host that cannot
gets the rule as an instruction and nothing more.

Rule 4 is the liveness property. Every dead-end this protocol has had came from
a rule that could stop a round ending.
