# Wishlist — the review tool

Features that have been considered for the review tool and are not being built yet. Each entry says
what it has to do to ship. An entry stays here until its acceptance criteria can be met.

## Derive review state from an event log

**What it should do.** A review's store holds an append-only log of events — sent, delivered,
replied, closed, claimed — and every reader derives state by replaying it. The same log and the
same question always give the same answer, so the gate's verdict is reproducible, a dispute about
how a round got into a state is settled by reading the log, and contention is settled by append
order instead of by locks.

**Acceptance criteria.**

1. The CLI surface is unchanged: every subcommand answers exactly as it does today, derived from
   the log instead of from mutated records.
2. Replaying a store's log reproduces its state, and `unanswered --session <id>` is a pure
   function of the log and the id. A test is a hand-written log and an expected verdict.
3. The first `claimed` event in the log wins a contested store. A watcher that lost reads that
   back and stands down, so two watchers sweeping the same store in the same second can no longer
   both adopt it.
4. A store written by the current version is read as the log's seed state. Nothing is migrated
   behind the user's back.
5. A line torn by a crash mid-append is ignored by every reader, and events are single-line
   appends small enough to be atomic on a local filesystem.

**What it needs.** A rewrite of the persistence layer in `review-server.mjs` — every subcommand
that reads or writes round state, a fold that derives state from events, and the test suites
rebuilt around log fixtures. This is the engine's core rewritten while it works, so it ships as
its own release, not alongside a feature. Liveness stays out of the log: the `watching` heartbeat
is ephemeral and remains a file beside it.

**Until then.** Ownership is a recorded field. Delivery stamps `deliveredTo` with the watcher's
`--session` id, the Stop hook asks `unanswered --session <id>`, and `watch --all` skips a store
whose heartbeat says another watcher covers it. The one gap this leaves is criterion 3's race:
two watchers that scan the same unclaimed store in the same moment can both adopt it, and the
round then belongs to whichever delivered last.

## Stop a round in flight

**Status: withdrawn on 5 August 2026**, after an implementation that could not meet criterion 1.

**What it should do.** The reviewer presses Stop and the agent stops working on that round.

**Acceptance criteria.**

1. Stop interrupts the agent's current turn, the way Esc does in the reviewer's own session.
   A request the agent has to notice for itself does not qualify.
2. The interruption holds without the agent calling a protocol command. An agent that never calls
   `check` still stops.
3. The workspace shows the round as ended once it has ended.

**What it needs.** A Host op that interrupts the running turn, exposed by every host the plugin
supports — or a host-specific adapter path, with a fallback that says plainly what happens on a host
without the op. `contracts/host.md` has no such op today.

**Until then.** The reviewer sends again. The brief is the state of the review rather than a diff,
so the next send supersedes the last one.
