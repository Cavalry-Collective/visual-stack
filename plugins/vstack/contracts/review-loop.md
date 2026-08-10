# Contract: Review loop

The local protocol between (1) the **review engine** (`review-server.mjs` +
workspace), (2) the **agent session**, and (3) the **reviewer** in the browser.

Host-independent: any Host that fulfills [host.md](host.md) can drive this loop.

One list of comments. Each is open or closed. The agent is the only one who
calls a comment done. Everything the workspace shows is derived from that list.

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
| `replies` | `{ by, text, at }[]`, append-only. An agent reply may carry `options: [{ text, recommended }]` — answers the reviewer picks from |
| `sentAt` | The reviewer let go of it. Null means it is still a draft |
| `deliveredAt` | The agent was last handed it. Null means it has never left the queue |
| `deliveredTo` | The session the last delivery was recorded for — the `--session` id its watcher was started with. Null when the watcher carried no identity |
| `activeAt` | The comment currently in the agent's hands. At most one open comment has this set |
| `dismissedAt` | The reviewer took it off the list after it had been delivered. The record stays; the workspace never shows it again |

The delivery fields and the thread carry the whole of a comment's progress:

| State | Delivery fields | Thread | Editable | Withdrawable |
| --- | --- | --- | --- | --- |
| Being written | none | any | yes | yes, the record goes |
| Queued for its first turn | `sentAt` only | any | no | yes, the record goes |
| With the agent | `sentAt`, `deliveredAt`, `activeAt` | agent has not answered this delivery | no | yes, the record stays behind it |
| Waiting on the reviewer | `sentAt`, `deliveredAt`; no `activeAt` | agent spoke last | no | yes, the record stays behind it |
| Answered and queued again | `sentAt`, `deliveredAt`; no `activeAt` | reviewer replied after delivery | no | yes, the record stays behind it |

---

## Who may do what

**Reviewer** — three verbs:

- Add a comment.
- Reply to a comment. A reply to a closed comment reopens it. Their own reply,
  while it is still the thread's last line, may be taken back (rule 7).
- Withdraw a comment, at any point.

A reviewer never closes a comment as done. Withdrawing takes it off the list
they are working from: a comment the agent has not been handed leaves no record
at all, and one it has been handed keeps a record marked `dismissedAt` and
`closed`, so the agent can still close what it was given. The agent is not
interrupted by a withdrawal and is not told of one.

**Agent** — three verbs:

- Take delivery of the oldest ready comment (the tick).
- Reply to a comment. This never changes its open/closed state and releases the active slot.
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
| `brief.md` | The one active comment, rewritten on every delivery |
| `versions/v<n>.html` | Frozen file, or the DOM capture for a live app |
| `versions/v<n>.meta.json` | `{ n, label, date }` |
| `reviews/v<n>/` | Only ever read: where a store filled by an older version keeps its comments |
| `handshake` | A stream watcher waiting to be told its events are being read |
| `delivery-offer.json` | A pull watcher found a round; its token must be claimed before delivery is recorded |
| `approved` | Sentinel: design signed off; engine shutting down |
| `share` | Sentinel: reviewer wants a shareable link |
| `url` | Present only while `serve` is running |
| `watching` | Heartbeat while Host op `watch_stream` is active |
| `listening` | Short lease renewed by bounded `watch_next` calls; ages out when pulls stop |

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
| `watch [--all] [--file …] [--stream \| --next --timeout <seconds>] [--session <id>]` | Push mode takes delivery; pull mode returns a durable offer or `IDLE`. `--session` names the session a stream delivery or later claim binds to |
| `ack --file/name … --token <token>` | Answer a stream watcher's handshake. Only this arms the `watching` heartbeat |
| `claim --file/name … --token <token> [--session <id>]` | Accept a pull `REVIEW` offer. Only this records delivery and writes `brief.md`; safe to retry only until another consumer wins |
| `publish --file/name … [--close ids] [--label …] [--summary …]` | Close comments, snapshot a version, or both. `--summary` records the account of the round, which the workspace shows; the latest one is kept and a publish without it clears it |
| `reply --file/name … --comment <id> --text "…" [--option "…" … --recommend <n>]` | Append `{ by: "agent", text, at }`, with `options: [{ text, recommended }]` when options are given. The reviewer answers by pressing one, which posts those words as their reply |
| `share --file/name … --url <url>` | Record public URL; clear the `share` sentinel |
| `status --file/name …` | Human/debug snapshot |
| `unanswered [--all] [--file/name …] [--session <id>]` | Comments the agent was handed and has not answered. Exits 1 while any remain. With `--session`, only deliveries recorded for that id count |
| `reset --file/name …` | Delete every comment and version for the review, and start again at v1 |

---

## Watch events

One line of stdout per event. Streams stay open; bounded pulls return one:

| Prefix | Meaning | Agent action |
| --- | --- | --- |
| `WATCHING` | Stream armed | — |
| `HANDSHAKE` | The watcher asking whether anyone receives it | Run the `ack` command it prints, immediately |
| `LINKED` | The handshake was answered and at least one review is covered | — |
| `UNLINKED` | The handshake was answered and no review turned up to cover | Start it again with `--file` if a review is running elsewhere |
| `UNWIRED` | The handshake went unanswered; the watcher exits `3` | Start it again via `watch_stream` |
| `IDLE` | Bounded pull timed out without an event | Run `watch_next` again while the review remains open |
| `REVIEW` | Stream: one comment delivered. Pull: token offered, nothing delivered yet | Pull runs printed `claim`; then read `brief.md`, apply it, `publish --close` / `reply` |
| `SHARE` | Link requested | Host `share` if capable; then `share --url` |
| `APPROVED` | Sign-off; server exiting | Confirm; next pipeline stage as skill says |
| `OPENED` | Another live store joined `--all` | — |
| `CLOSED` | Tab/store gone | Drop; exit when none left |

A reviewer reply makes that thread ready again. It rejoins the FIFO at the time
of the reply and waits for the active comment to finish.

---

## The loop

```
serve (background) + watch_stream | watch_next
        │
        ▼
reviewer comments ──Send──► comments.json
        │                         │
        │                    REVIEW event
        │                    push: delivery recorded
        │                    pull: claim ──► brief.md (delivery recorded)
        │                         ▼
        │              agent: apply · reply/close · publish
        │                         │
        │◄──── version ready ─────┘
        │
 Approve ──► approved ──► APPROVED + server exit
  Share ──► share ──► SHARE ──► share --url
```

Rules:

1. Only `publish --close` says a comment is done. The reviewer has no resolve. Withdrawing (rule 9) takes a comment off their list and says nothing about the work.
2. A tick hands over exactly one comment: the oldest ready first send or thread answer. One active comment blocks every later delivery.
3. Closing the active comment releases the queue. Replying also releases it, so the next ready comment can proceed while that thread waits on the reviewer. The reviewer's answer rejoins the FIFO at its reply time.
4. **Nothing can refuse a close.** An agent that has taken delivery can always finish, whatever the reviewer did meanwhile.
5. Closing what is already closed is a no-op, so a retried command is safe.
6. A comment's words are frozen when the reviewer sends it. The engine keeps the stored note whatever a client saves afterwards.
7. A reply is append-only in a save, from either role: two copies of a thread merge to the union of both, so a line missing from one copy is never a removal. Removal is a request of its own. The reviewer may take back their own reply while it is the thread's last line; once anything has been said over it, it stays. The agent is not told of a take-back and finishes from whatever it already took delivery of (rule 4).
8. A reviewer's reply to a closed comment reopens it. An agent's reply never changes state.
9. A comment may be withdrawn at any point. Undelivered, it is deleted. Delivered, it is marked `dismissedAt` and `closed`: it leaves the workspace, no tick raises it again, and the id still resolves so the agent holding it can close it.
10. A version is a snapshot to look at. It records no comments, and no comment records a version.
11. One `watch_stream` per push session, or one repeated `watch_next` loop per pull session, is enough with `--all`.
12. Presence is proven. A stream watcher writes `watching` from the moment its handshake is answered. A pull call renews `listening` only while its bounded foreground wait is active; the lease survives the small re-arm gap and then ages out. **Linked** means at least one proof is fresh.
13. Presence is per review and per consumer. A push watcher heartbeats only the stores it covers. Pull consumers may overlap because they share one durable offer and `claim` serialises delivery.
14. An agent that took delivery answers. The active comment is answered by closing it or replying to it. Neither leaves the queue blocked by a turn that stopped halfway. `unanswered` names that comment and exits 1 while it remains active and unanswered.
15. An active comment goes back to the queue when nothing is listening. That is the way out of a turn whose agent session died. `activeAt`, `deliveredAt` and `deliveredTo` are cleared. Comments waiting on reviewer answers stay where they are. The engine refuses recovery while either push heartbeat or pull lease is fresh, because then an agent still holds the active comment and rule 14 applies instead.
16. A delivery binds to a session. A watcher started with `--session <id>` records that id on the comment it hands over. A later delivery of the same thread binds it to the latest session. `unanswered --session <id>` answers for that session alone, so a Host that gates the end of a turn never holds one session's turn open for another session's work. A delivery recorded with no identity is reported only by the unfiltered form.
17. A push or legacy one-shot `watch --all` never covers a store whose push heartbeat or pull lease is fresh. A pull `watch --next` may overlap another pull: both see the same offer and only one claim can record delivery. A store named with `--file` is covered regardless — naming it is a deliberate takeover.

Rule 14 is an obligation on the agent and the engine's queue gate. `publish`
still closes exactly what it names. A Host that can gate the end of a turn also
enforces the obligation at the turn boundary. See the Stop hook in
`plugins/vstack/hooks/`. A Host that cannot gets the rule as an instruction.

Rule 4 is the liveness property. Every dead-end this protocol has had came from
a rule that could stop a round ending.
