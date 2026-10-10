#!/usr/bin/env node
/*
 * What `unanswered` calls an unfinished round, and what the Stop hook does with it.
 *
 * The rule under test: a comment the agent took delivery of is answered by
 * closing it or by replying to it, and until one of those happens the round has
 * not been handed back.
 */

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(HERE, '../assets/review-server.mjs')
const GATE = path.resolve(HERE, '../../../hooks/round-gate.mjs')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-gate-test-'))
const page = path.join(temp, 'page.html')
const port = 19000 + (process.pid % 1000)
const origin = `http://127.0.0.1:${port}`
let server = null

const cli = (...argv) => spawnSync(process.execPath, [SERVER, ...argv], {
  encoding: 'utf8', cwd: temp, timeout: 20_000,
})

/** The gate as Claude Code runs it: the Stop payload on stdin, a decision out. */
const gate = (input = {}) => {
  const run = spawnSync(process.execPath, [GATE], {
    encoding: 'utf8', cwd: temp, timeout: 20_000,
    input: JSON.stringify({ hook_event_name: 'Stop', cwd: temp, ...input }),
  })
  assert.equal(run.status, 0, `the hook itself must never fail: ${run.stderr}`)
  return run.stdout.trim() ? JSON.parse(run.stdout) : null
}

const post = (pathname, body) => fetch(origin + pathname, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

const comment = (id, note, extra = {}) => ({
  id, kind: 'area', note, size: 'desktop', replies: [],
  sentAt: new Date().toISOString(), ...extra,
})

/** One tick: block until there is something to hand over, take it, and exit. */
const tick = () => cli('watch', '--file', page)

async function waitForServer () {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin + '/api/project')).ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('review server did not start')
}

try {
  fs.writeFileSync(page, '<!doctype html><title>Page</title><main><p id="hero">Hi</p></main>')
  server = spawn(process.execPath, [SERVER, 'serve', '--file', page, '--port', String(port),
    '--idle-timeout', '0', '--no-open'], { cwd: temp, stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForServer()

  // Nothing has been written, so there is nothing to owe.
  assert.equal(cli('unanswered', '--all').status, 0, 'a review with no comments is finished')
  assert.equal(gate(), null, 'the gate lets a quiet turn end')

  // Queued but not delivered: the agent has not been handed it, so it owes
  // nothing yet. The watcher is what hands it over.
  await post('/api/comments', { comments: [comment('c1', 'Make the hero bigger')] })
  assert.equal(cli('unanswered', '--all').status, 0, 'a queued comment is not the agent\'s to answer')

  // Delivered and untouched — the round stopped halfway.
  assert.match(tick().stdout, /REVIEW/, 'the tick hands the comment over')
  const owed = cli('unanswered', '--all')
  assert.equal(owed.status, 1, 'a delivered comment with nothing said about it is outstanding')
  assert.match(owed.stdout, /c1/, 'it names the comment')
  assert.match(owed.stdout, /publish .* --close c1/, 'it names the command that settles it')
  assert.equal(owed.stdout.match(/you took delivery of/g).length, 1,
    'one review is reported once, however many ways its store is reached')

  const blocked = gate()
  assert.equal(blocked?.decision, 'block', 'the gate holds the turn open')
  assert.match(blocked.reason, /c1/, 'the agent is told which comment it left')

  // Having already blocked once this turn, the gate stands aside.
  assert.equal(gate({ stop_hook_active: true }), null, 'the gate blocks at most once per turn')

  // Replying answers it without closing it: the agent asked a question, which
  // is a legitimate way to end a round.
  assert.equal(cli('reply', '--file', page, '--comment', 'c1', '--text', 'How much bigger?').status, 0)
  assert.equal(cli('unanswered', '--all').status, 0, 'a reply hands the round back')

  // The reviewer writes about something else while c1 waits on them. Asking
  // released the active slot, so the new comment can take its own turn.
  await post('/api/comments', { comments: [comment('c3', 'And centre the footer')] })
  assert.match(tick().stdout, /REVIEW/, 'the new comment is handed over')
  const alongside = cli('unanswered', '--all')
  assert.equal(alongside.status, 1, 'the comment nothing has been said about is outstanding')
  assert.match(alongside.stdout, /c3/, 'it names that comment')
  assert.doesNotMatch(alongside.stdout, /c1/,
    'a question waiting on the reviewer is not delivered alongside new work')
  assert.equal(cli('publish', '--file', page, '--close', 'c3', '--label', 'Footer centred').status, 0)

  // The reviewer answers. That comment is waiting for the next tick, not for
  // the agent, so it must not hold the turn open.
  const answered = { by: 'reviewer', text: 'Twice', at: new Date().toISOString() }
  await post('/api/comments', { comments: [comment('c1', 'Make the hero bigger', { replies: [answered] })] })
  assert.equal(cli('unanswered', '--all').status, 0, 'a comment awaiting delivery is not outstanding')

  // Delivered again, and now unanswered again.
  assert.match(tick().stdout, /REVIEW/, 'the answer comes back round')
  assert.equal(cli('unanswered', '--all').status, 1, 'the agent owes an answer once more')

  // Closing it finishes the round.
  assert.equal(cli('publish', '--file', page, '--close', 'c1', '--label', 'Hero doubled').status, 0)
  assert.equal(cli('unanswered', '--all').status, 0, 'closing hands the round back')
  assert.equal(gate(), null, 'the gate lets the turn end')

  // The reviewer takes a delivered comment off the list. It is no longer on the
  // review, so there is nothing left to answer and the turn can end.
  await post('/api/comments', { comments: [comment('cx', 'Never mind this one')] })
  assert.match(tick().stdout, /REVIEW/, 'it is handed over first')
  assert.equal(cli('unanswered', '--all').status, 1, 'and it is outstanding while it stands')
  await post('/api/comments/dismiss', { id: 'cx' })
  assert.equal(cli('unanswered', '--all').status, 0, 'a comment taken off the list owes nothing')
  assert.equal(gate(), null, 'the gate lets the turn end')

  // A delivery binds to the session whose watcher took it, and the gate holds
  // that session only. A session that never saw the round walks free — and is
  // not handed the ids and commands that would close someone else's round.
  await post('/api/comments', { comments: [comment('c4', 'Tighten the nav')] })
  assert.match(cli('watch', '--file', page, '--session', 'sess-a').stdout, /REVIEW/,
    'the tick hands the comment to sess-a')
  assert.equal(gate({ session_id: 'sess-a' })?.decision, 'block', 'the session that took delivery is held')
  assert.equal(gate({ session_id: 'sess-b' }), null, 'a session that never took delivery is not')
  assert.equal(cli('unanswered', '--all').status, 1,
    'asked without an identity, the round still shows — a person asking means the review, not a session')
  assert.equal(cli('publish', '--file', page, '--close', 'c4', '--label', 'Nav tightened').status, 0)
  assert.equal(gate({ session_id: 'sess-a' }), null, 'closing frees the owner too')

  // The sweep never covers a review whose heartbeat is fresh: that is another
  // session's watcher, and covering it twice would deliver one comment to two
  // sessions. Once the heartbeat is gone the review is anyone's to take, and
  // the new delivery re-binds the round to whoever took it.
  const store = JSON.parse(cli('status', '--file', page).stdout).store
  await post('/api/comments', { comments: [comment('c5', 'Widen the gutter')] })
  fs.writeFileSync(path.join(store, 'watching'), String(Date.now()))
  assert.match(cli('watch', '--all').stdout, /nothing to watch/, 'a covered review is not covered twice')
  fs.rmSync(path.join(store, 'watching'))
  assert.match(cli('watch', '--all', '--session', 'sess-b').stdout, /REVIEW/, 'unclaimed, the sweep takes it')
  assert.equal(gate({ session_id: 'sess-b' })?.decision, 'block', 'delivery bound the round to the sweeper')
  assert.equal(gate({ session_id: 'sess-a' }), null, 'and to no one else')
  assert.equal(cli('publish', '--file', page, '--close', 'c5', '--label', 'Gutter widened').status, 0)

  // A review nobody is looking at is over. `--all` reads live stores only, so
  // the gate cannot strand a session on a round whose tab has gone.
  await post('/api/comments', { comments: [comment('c2', 'And centre it')] })
  assert.match(tick().stdout, /REVIEW/, 'the second comment is handed over')
  assert.equal(cli('unanswered', '--all').status, 1, 'outstanding while the review is live')
  server.kill('SIGTERM')
  for (let attempt = 0; attempt < 60 && server.exitCode === null; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(cli('unanswered', '--all').status, 0, 'a closed review owes nothing')
  assert.equal(cli('unanswered', '--file', page).status, 1,
    'the named form still reports it, because a person asking about one review means it')

  console.log('round gate: ok')
} finally {
  server?.kill('SIGTERM')
  fs.rmSync(temp, { recursive: true, force: true })
}
