# Contract: Bridge loop

How a session stays linked to a page served by `lib/json-bridge.mjs` — the
shared engine behind `user-story-map`, `polish`, `spec` and `phase-build`. Host-independent:
each skill's SKILL.md names the host mechanism that fulfills the two roles here
(a background process for `serve`, a persistent stream for `watch`).

## The watcher

After `serve` starts (in the background — it must outlive the turn) and prints
its URL, token and seq, arm the watcher as a persistent stream:

```bash
node <lib>/json-bridge.mjs watch --json <doc.json> --stream --tool <skill> \
  --seq <the seq the server printed>
```

**It never exits.** Each line of stdout is one event, delivered as it happens,
so there is nothing to re-arm after a round — which is the step that gets
forgotten and leaves a page nobody is reading.

**Pass the seq the server printed, not a fresh read.** The stream carries its
own position from there, so a send that lands between rounds cannot be
swallowed.

A Host with pull delivery (`watch_next` in [host.md](host.md)) cannot hold a
stream, so it waits in bounded calls instead:

```bash
node <lib>/json-bridge.mjs watch --json <doc.json> --tool <skill> \
  --next --timeout 25 --seq <the seq the server printed>
```

Each call returns one event, or `IDLE` when the time is up, and always ends
with a `WAIT` line holding the exact command to run next, carrying the seq it
reached. Run that command, not a fresh one, so a send that lands between two
calls is still reported. The page stays **Linked** while the calls keep
coming.

| Event | Meaning | Agent action |
| --- | --- | --- |
| `WATCHING` | Stream armed | — |
| `IDLE` | A bounded wait ran out with nothing new | Run the `WAIT` command |
| `WAIT` | Ends every bounded wait | The command that resumes it |
| `SENT` | An edited document landed in the JSON file | Read the file back — it is the new source of truth |
| `APPROVED` | The document is signed off | Say so; carry on with what comes next |
| `CLOSED` | The tab went away; the server has exited | Say the link is closed and stop serving |

## Link states

While the watcher runs the page shows **Linked**; with no watcher it shows
**Unlinked**, in amber, so the user can see that a Send would sit there unread.

## Idle close

The page holds an SSE connection. When the last one goes away and none returns
within the grace period (`--idle-timeout`, default 90s — long enough that a
reload reconnects), the server removes its `url` file and exits. That exit ends
the watcher with `CLOSED`. `--idle-timeout 0` keeps the server up until it is
stopped explicitly.

Either way, **say when the link is closed** — the user should never have to
guess whether a socket is still open. After that the page's Send goes grey
(*Link lost*) and only the copy fallback works. Nothing is lost: the last sent
state is on disk in the JSON file.
