#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(HERE, '../assets/review-server.mjs')
/* A space in the path, because a project under "My Projects" is ordinary and
   every command this suite prints for an agent to copy has to survive it. */
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack review test '))
const page = path.join(temp, 'page.html')
const store = path.join(temp, '.vstack', 'local', 'review', 'page')
const port = 18000 + (process.pid % 1000)
const origin = `http://127.0.0.1:${port}`

const cli = (...argv) => spawnSync(process.execPath, [SERVER, ...argv, '--file', page], {
  encoding: 'utf8', cwd: temp,
})

async function request (pathname, options) {
  const response = await fetch(origin + pathname, options)
  const body = await response.json()
  return { response, body }
}

const post = (pathname, body) => request(pathname, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

async function waitForServer () {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const result = await request('/api/project')
      if (result.response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('review server did not start')
}

async function startServer () {
  const child = spawn(process.execPath, [SERVER, 'serve', '--file', page, '--port', String(port), '--idle-timeout', '0', '--host', 'codex', '--no-open'], {
    cwd: temp, stdio: ['ignore', 'pipe', 'pipe'],
  })
  server = child
  await waitForServer()

  const workspace = await fetch(origin + '/')
  assert.equal(workspace.status, 200)
  assert.match(await workspace.text(), /window\.__VSTACK_HOST__=\{"id":"codex","name":"Codex"/)
}

/** What the workspace saves. `sentAt` set means the reviewer let go of it. */
const comment = (id, note, extra = {}) => ({
  id, kind: 'area', note, size: 'desktop', replies: [], ...extra,
})
const write = comments => post('/api/comments', { comments })
const send = comments => write(comments.map(item => ({ ...item, sentAt: new Date().toISOString() })))

const stored = () => JSON.parse(fs.readFileSync(path.join(store, 'comments.json'))).comments
const byId = id => stored().find(item => item.id === id)
const briefText = () => fs.readFileSync(path.join(store, 'brief.md'), 'utf8')

/** One tick: block until there is something to hand over, take it, and exit. */
const tick = () => spawnSync(process.execPath, [SERVER, 'watch', '--file', page], {
  encoding: 'utf8', cwd: temp, timeout: 20_000,
}).stdout

let server
try {
  fs.writeFileSync(page, '<!doctype html><title>Review test</title><p>Initial</p>')
  assert.equal(cli('publish', '--label', 'Initial').status, 0)
  await startServer()

  /* ── a bounded pull completes inside one foreground call ── */

  const idlePull = cli('watch', '--next', '--timeout', '1')
  assert.equal(idlePull.status, 0, idlePull.stderr)
  assert.match(idlePull.stdout, /IDLE/, 'a quiet pull returns instead of leaving a terminal session behind')
  assert.match(idlePull.stdout, /watch --next --timeout 1/,
    'a bounded wait ends by naming the command that resumes it — nothing else will')
  assert.match(idlePull.stdout, new RegExp(`--file "${page.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    'and quotes its arguments, so the command survives being copied')
  const idleLease = path.join(store, 'listening')
  assert.ok(fs.existsSync(idleLease), 'the wait leaves a lease across the prompt re-arm gap')
  fs.rmSync(idleLease, { force: true })

  /* ── a comment is the reviewer's until they let go of it ── */

  await write([comment('c1', 'First draft')])
  assert.equal(byId('c1').sentAt, null, 'a comment being written has not been sent')
  assert.equal(byId('c1').state, 'open')

  await write([comment('c1', 'First, reworded')])
  assert.equal(byId('c1').note, 'First, reworded', "a draft is still the reviewer's to rewrite")

  const project = await request('/api/project')
  assert.equal(project.body.comments.length, 1)
  assert.equal(project.body.comments[0].deliveredAt, null, 'nothing is delivered until a tick takes it')

  await send([comment('c1', 'First, reworded'), comment('c2', 'Second')])
  assert.ok(byId('c1').sentAt, 'sending stamps the comment')

  /* ── sent means frozen ── */

  await write([comment('c1', 'Something else entirely', { sentAt: byId('c1').sentAt })])
  assert.equal(byId('c1').note, 'First, reworded',
    'a comment already sent cannot be reworded, whatever a stale tab saves')

  /* ── the tick hands over one comment at a time, FIFO ── */

  let out = tick()
  assert.match(out, /REVIEW/)
  assert.match(out, /1 open, 1 new/)
  assert.match(briefText(), /### c1 · NEW/)
  assert.match(briefText(), /First, reworded/)
  assert.doesNotMatch(briefText(), /Second/, 'the next comment does not distract from the active one')
  assert.match(briefText(), /--close <id>/)
  assert.ok(byId('c1').deliveredAt, 'delivery is recorded on the comment')
  assert.ok(byId('c1').activeAt, 'the delivered comment owns the single active slot')
  assert.equal(byId('c2').deliveredAt, null, 'the second comment remains queued')
  const uninterrupted = cli('watch', '--next', '--timeout', '1')
  assert.match(uninterrupted.stdout, /IDLE/, 'a waiting comment cannot raise another delivery mid-turn')
  fs.rmSync(path.join(store, 'listening'), { force: true })

  /* ── closing is the agent's alone, and partial by design ── */

  const published = cli('publish', '--close', 'c1', '--label', 'Reworded heading')
  assert.equal(published.status, 0)
  assert.equal(byId('c1').state, 'closed')
  assert.equal(byId('c2').state, 'open', 'a comment nobody named is still open')
  assert.equal(byId('c1').activeAt, null, 'closing releases the active slot')
  assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'state.json'))).version, 2)
  assert.doesNotMatch(published.stdout, /still open/, 'queued work is not work the agent silently left behind')

  assert.equal(cli('publish', '--close', 'c1').status, 0, 'closing what is closed is a no-op')
  assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'state.json'))).version, 2,
    'closing without a label adds no version')

  /* ── a reply on a closed comment is how the reviewer reopens it ── */

  await write([{ ...byId('c1'), replies: [{ by: 'reviewer', text: 'Not like that', at: new Date().toISOString() }] }])
  assert.equal(byId('c1').state, 'open', 'answering something called done says it is not done')
  out = tick()
  assert.match(out, /1 open, 1 new/, 'the older queued comment keeps its place ahead of the reopened one')
  assert.match(briefText(), /### c2 · NEW/)
  assert.doesNotMatch(briefText(), /Not like that/)

  /* ── a question releases the slot; its answer rejoins the FIFO ── */

  assert.equal(cli('reply', '--comment', 'c2', '--text', 'Which card?').status, 0)
  assert.equal(byId('c2').activeAt, null, 'asking releases the active slot')
  assert.equal(byId('c2').state, 'open', 'asking is not a state — the comment stays open')
  out = tick()
  assert.match(out, /1 open/, 'the next ready comment proceeds while c2 waits on the reviewer')
  assert.doesNotMatch(out, /new/, 'a reopened comment is not new')
  assert.match(briefText(), /They replied:\*\* Not like that/)
  assert.doesNotMatch(briefText(), /### c2/)

  /* ── a stranded round goes back to the queue ── */

  const watching = path.join(store, 'watching')
  fs.writeFileSync(watching, String(Date.now()))
  const held = await post('/api/comments/requeue', {})
  assert.equal(held.response.status, 409, 'nothing is taken off an agent that is listening')
  assert.ok(byId('c1').deliveredAt, 'and the handover stands')

  /* Nothing listening: only the active comment is stranded. The question on c2
     is still where it belongs, waiting on the reviewer. */
  const note = byId('c1').note
  fs.rmSync(watching, { force: true })
  const requeued = await post('/api/comments/requeue', {})
  assert.equal(requeued.response.status, 200)
  assert.deepEqual(requeued.body.requeued, ['c1'])
  assert.equal(byId('c1').deliveredAt, null, 'only the record of the handover goes')
  assert.ok(byId('c2').deliveredAt, 'a question waiting on the reviewer is not requeued')
  assert.equal(byId('c1').state, 'open', 'the comment itself is untouched')
  assert.equal(byId('c1').note, note, 'and it still says what it said')

  out = tick()
  assert.match(out, /REVIEW/, 'the next session to pick up is handed the stranded round')
  assert.match(out, /1 open, 1 new/, 'the recovered comment is new to the session receiving it')

  /* ── the thread is append-only, from either side ── */

  // A tab that never saw the agent's question saves its own copy of the thread.
  await write([{
    ...comment('c2', 'Second', { sentAt: byId('c2').sentAt }),
    replies: [{ by: 'reviewer', text: 'The second one', at: new Date().toISOString() }],
  }])
  assert.deepEqual(byId('c2').replies.map(reply => reply.by), ['agent', 'reviewer'],
    'neither side can lose a line of the thread by being stale')

  assert.equal(cli('publish', '--close', 'c1', '--label', 'First done').status, 0)
  out = tick()
  assert.match(out, /1 open/, 'the answered thread returns after the active comment finishes')
  assert.match(briefText(), /They replied:\*\* The second one/)

  /* ── prose flags carry paragraph breaks a shell would not resolve ── */

  assert.equal(cli('reply', '--comment', 'c2',
    '--text', 'One.\\n\\nTwo.',
    '--option', 'Split on \\\\n', '--option', 'Keep\\nboth').status, 0)
  const escaped = byId('c2').replies.at(-1)
  assert.equal(escaped.text, 'One.\n\nTwo.', 'an escaped break reaches the reviewer as a break')
  assert.deepEqual(escaped.options.map(option => option.text), ['Split on \\n', 'Keep\nboth'],
    'a doubled backslash is how an option says the two characters')

  /* ── liveness: whatever the reviewer did meanwhile, the agent can finish ── */

  assert.equal(cli('publish', '--close', 'c1,c2', '--label', 'Both done').status, 0,
    'nothing the reviewer does can stop the agent closing what it was given')
  assert.deepEqual(stored().map(item => item.state), ['closed', 'closed'])

  /* ── withdrawal, before and after delivery ── */

  await write([comment('c3', 'Third')])
  let dismissed = await post('/api/comments/dismiss', { id: 'c3' })
  assert.equal(dismissed.response.status, 200, "a draft is the reviewer's to take back")
  assert.equal(stored().find(item => item.id === 'c3'), undefined)

  await send([comment('c4', 'Fourth')])
  dismissed = await post('/api/comments/dismiss', { id: 'c4' })
  assert.equal(dismissed.response.status, 200, 'queued is still only waiting here')

  await send([comment('c5', 'Fifth')])
  tick()
  dismissed = await post('/api/comments/dismiss', { id: 'c5' })
  assert.equal(dismissed.response.status, 200, 'a comment is the reviewer\'s to take off the list')
  assert.ok(byId('c5').dismissedAt, 'one already delivered keeps its record')
  assert.equal(byId('c5').state, 'closed', 'and nothing raises it again')
  const gone = await request('/api/project')
  assert.equal(gone.body.comments.find(item => item.id === 'c5'), undefined,
    'the workspace never shows it again')
  assert.equal(gone.body.activeCount, 1,
    'the workspace can still recover a hidden active comment if its session dies')
  assert.equal(cli('publish', '--close', 'c5').status, 0,
    'the agent holding it can still close what it was given')
  assert.equal((await request('/api/project')).body.activeCount, 0, 'closing releases the hidden slot')

  /* ── the agent cannot close what it was never given ── */

  await write([comment('c6', 'Sixth, still being written')])
  const early = cli('publish', '--close', 'c6')
  assert.equal(early.status, 2)
  assert.match(early.stderr, /c6 has not been sent yet/)
  await send([comment('c7', 'Seventh')])
  const unknown = cli('publish', '--close', 'c7,c404')
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /c404 is not a comment on this review/)
  assert.equal(byId('c7').state, 'open', 'a rejected close changes nothing at all')

  /* ── pull delivery is offered, then explicitly claimed ── */

  const firstOffer = cli('watch', '--next', '--timeout', '1')
  assert.equal(firstOffer.status, 0, firstOffer.stderr)
  const token = firstOffer.stdout.match(/token ([0-9a-f]+)/)?.[1]
  assert.ok(token, `the pull names its durable offer:\n${firstOffer.stdout}`)
  assert.equal(byId('c7').deliveredAt, null,
    'writing REVIEW output is not delivery until the agent reads and claims it')
  assert.equal(cli('unanswered', '--all').status, 0,
    'an unread offer cannot make the agent owe a round')

  const competingOffer = cli('watch', '--next', '--timeout', '1')
  assert.match(competingOffer.stdout, new RegExp(`token ${token}`),
    'overlapping pull consumers see one shared offer')
  assert.equal(byId('c7').deliveredAt, null, 'neither consumer wins merely by waiting')

  const claimed = cli('claim', '--token', token, '--session', 'pull-a')
  assert.equal(claimed.status, 0, claimed.stderr)
  assert.match(claimed.stdout, /CLAIMED/)
  assert.match(claimed.stdout, /watch --all .* --next/,
    'taking a round names the wait to come back to once it is answered')
  assert.ok(byId('c7').deliveredAt, 'claim is the delivery point')
  assert.equal(byId('c7').deliveredTo, 'pull-a', 'claim binds delivery to its session')
  assert.equal(cli('claim', '--token', token, '--session', 'pull-b').status, 2,
    'a competing claim cannot deliver the same offer twice')

  const listening = path.join(store, 'listening')
  assert.ok(fs.existsSync(listening), 'the bounded pull leaves a short consumer lease')
  const heldByPull = await post('/api/comments/requeue', {})
  assert.equal(heldByPull.response.status, 409, 'a fresh pull lease protects a claimed round')

  const expired = new Date(Date.now() - 60_000)
  fs.utimesSync(listening, expired, expired)
  const pullRequeued = await post('/api/comments/requeue', {})
  assert.equal(pullRequeued.response.status, 200, 'an abandoned pull lease ages out')
  assert.deepEqual(pullRequeued.body.requeued, ['c7'])
  assert.equal(byId('c7').deliveredAt, null, 'the abandoned round becomes available again')

  const nextOffer = cli('watch', '--next', '--timeout', '1')
  const nextToken = nextOffer.stdout.match(/token ([0-9a-f]+)/)?.[1]
  assert.ok(nextToken && nextToken !== token, 'a requeued round receives a fresh offer')
  assert.equal(cli('claim', '--token', nextToken).status, 0)
  assert.equal(cli('publish', '--close', 'c7', '--label', 'Seventh done').status, 0)

  /* ── a live review nobody is watching is named, not called all-clear ── */

  await send([comment('c8', 'Eighth')])
  const covered = cli('unanswered', '--all')
  assert.equal(covered.status, 0)
  assert.match(covered.stdout, /Nothing outstanding/,
    'a fresh pull lease means the loop is still running; the wait between calls is not a fault')

  fs.rmSync(path.join(store, 'listening'), { force: true })
  const dropped = cli('unanswered', '--all')
  assert.match(dropped.stdout, /comments are waiting and nothing is watching/,
    'the end-of-turn check names a review whose watch loop stopped with a queue behind it')
  assert.match(dropped.stdout, /--next --timeout 25/, 'and says how to start watching again')
  assert.equal(dropped.status, 0,
    'a comment this session never took delivery of does not block the end of its turn')

  const strandedOffer = cli('watch', '--next', '--timeout', '1')
  const strandedToken = strandedOffer.stdout.match(/token ([0-9a-f]+)/)?.[1]
  assert.equal(cli('claim', '--token', strandedToken).status, 0)
  assert.match(cli('unanswered', '--all').stdout, /have not answered it/,
    'once delivered, the same comment is owed by the session that took it')
  assert.equal(cli('publish', '--close', 'c8', '--label', 'Eighth done').status, 0)

  /* ── a store written by an older version is read where it lies ── */

  const old = path.join(temp, 'old')
  const oldStore = path.join(old, '.vstack', 'local', 'review', 'legacy')
  fs.mkdirSync(path.join(oldStore, 'reviews', 'v1'), { recursive: true })
  fs.mkdirSync(path.join(oldStore, 'reviews', 'v2'), { recursive: true })
  fs.writeFileSync(path.join(old, 'legacy.html'), '<!doctype html><title>Legacy</title><p>x</p>')
  fs.writeFileSync(path.join(oldStore, 'state.json'), JSON.stringify({ version: 2, name: 'legacy' }))
  fs.writeFileSync(path.join(oldStore, 'reviews', 'v1', 'annotations.json'), JSON.stringify({
    annotations: [
      { id: 'a1', note: 'Done back then', status: 'addressed', sentAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a2', note: 'Withdrawn', dismissed: true },
      { id: 'a3', note: 'Stale copy', status: 'open', sentAt: '2026-01-01T00:00:00.000Z' },
    ],
  }))
  fs.writeFileSync(path.join(oldStore, 'reviews', 'v2', 'annotations.json'), JSON.stringify({
    annotations: [
      {
        id: 'a3', note: 'Still open', status: 'question', sentAt: '2026-01-02T00:00:00.000Z',
        replies: [{ by: 'claude', text: 'Which one?', at: '2026-01-02T00:00:00.000Z' }],
      },
    ],
  }))
  const legacy = spawnSync(process.execPath, [SERVER, 'status', '--file', path.join(old, 'legacy.html')], {
    encoding: 'utf8', cwd: old,
  })
  assert.equal(legacy.status, 0)
  const adopted = JSON.parse(legacy.stdout).comments
  assert.deepEqual(adopted.map(item => [item.id, item.state]).sort(),
    [['a1', 'closed'], ['a2', 'closed'], ['a3', 'open']],
    'addressed and withdrawn are both closed, and the newest copy of an id wins')
  assert.equal(adopted.find(item => item.id === 'a3').note, 'Still open')
  assert.ok(fs.existsSync(path.join(oldStore, 'reviews', 'v1', 'annotations.json')),
    'the older store is read where it lies, never moved')

  console.log('review lifecycle integration: ok')
} finally {
  server?.kill('SIGTERM')
  fs.rmSync(temp, { recursive: true, force: true })
}
