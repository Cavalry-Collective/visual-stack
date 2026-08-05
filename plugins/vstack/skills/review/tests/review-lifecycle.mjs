#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(HERE, '../assets/review-server.mjs')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-review-test-'))
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

  /* ── the tick hands over everything open ── */

  let out = tick()
  assert.match(out, /REVIEW/)
  assert.match(out, /2 open, 2 new/)
  assert.match(briefText(), /### c1 · NEW/)
  assert.match(briefText(), /First, reworded/)
  assert.match(briefText(), /--close <ids>/)
  assert.ok(byId('c1').deliveredAt, 'delivery is recorded on the comment')

  /* ── closing is the agent's alone, and partial by design ── */

  const published = cli('publish', '--close', 'c1', '--label', 'Reworded heading')
  assert.equal(published.status, 0)
  assert.equal(byId('c1').state, 'closed')
  assert.equal(byId('c2').state, 'open', 'a comment nobody named is still open')
  assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'state.json'))).version, 2)
  // The tick wakes for what the reviewer says, so a comment left open has to be
  // named where the agent believes it has finished.
  assert.match(published.stdout, /1 comment\(s\) you were given are still open: c2/)

  assert.equal(cli('publish', '--close', 'c1').status, 0, 'closing what is closed is a no-op')
  assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'state.json'))).version, 2,
    'closing without a label adds no version')

  /* ── a reply on a closed comment is how the reviewer reopens it ── */

  await write([{ ...byId('c1'), replies: [{ by: 'reviewer', text: 'Not like that', at: new Date().toISOString() }] }])
  assert.equal(byId('c1').state, 'open', 'answering something called done says it is not done')
  out = tick()
  assert.match(out, /2 open/, 'everything open goes, not only what was just said')
  assert.doesNotMatch(out, /new/, 'a comment coming round again is not new')
  assert.match(briefText(), /They replied:\*\* Not like that/)
  assert.match(briefText(), /### c2/)

  /* ── the thread is append-only, from either side ── */

  assert.equal(cli('reply', '--comment', 'c2', '--text', 'Which card?').status, 0)
  assert.equal(byId('c2').state, 'open', 'asking is not a state — the comment stays open')
  // A tab that never saw the agent's question saves its own copy of the thread.
  await write([{
    ...comment('c2', 'Second', { sentAt: byId('c2').sentAt }),
    replies: [{ by: 'reviewer', text: 'The second one', at: new Date().toISOString() }],
  }])
  assert.deepEqual(byId('c2').replies.map(reply => reply.by), ['agent', 'reviewer'],
    'neither side can lose a line of the thread by being stale')

  /* ── liveness: whatever the reviewer did meanwhile, the agent can finish ── */

  tick()
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
  assert.equal(dismissed.response.status, 409,
    'once it is with the agent, taking it back is a reply asking for it back')
  assert.match(dismissed.body.error, /Reply on it/)

  /* ── the agent cannot close what it was never given ── */

  await write([comment('c6', 'Sixth, still being written')])
  const early = cli('publish', '--close', 'c6')
  assert.equal(early.status, 2)
  assert.match(early.stderr, /c6 has not been sent yet/)
  const unknown = cli('publish', '--close', 'c5,c404')
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /c404 is not a comment on this review/)
  assert.equal(byId('c5').state, 'open', 'a rejected close changes nothing at all')

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
