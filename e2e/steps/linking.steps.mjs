import { Then, When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

When('the agent arms the stream watcher', function () {
  this.startStreamWatcher()
})

Then('the watcher asks for a handshake', async function () {
  const match = await this.watcherSays(/HANDSHAKE[\s\S]*?--token ([0-9a-f]+)/)
  this.handshakeToken = match[1]
})

When('the agent answers the handshake', function () {
  const run = this.cli('ack', '--all', '--token', this.handshakeToken)
  assert.equal(run.status, 0, run.stderr)
})

Then('the watcher reports LINKED', async function () {
  await this.watcherSays(/LINKED/)
})

Then('the agent\'s presence is heartbeated', async function () {
  const heartbeat = path.join(this.store, 'watching')
  const start = Date.now()
  while (!fs.existsSync(heartbeat) && Date.now() - start < 5000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(fs.existsSync(heartbeat), 'the watching heartbeat is written once acked')
})

Then('the watcher receives a REVIEW event', async function () {
  await this.watcherSays(/REVIEW/)
})

Then('the workspace cannot requeue the round while the watcher lives', async function () {
  // Give the delivery a moment to be recorded, then ask the server to requeue:
  // rule 15 refuses while a live watcher's heartbeat says the agent holds it.
  await this.watcherSays(/REVIEW/)
  const requeued = await this.post('/api/comments/requeue', {})
  assert.equal(requeued.response.status, 409,
    'nothing is taken off an agent that is listening')
})

When('the agent runs a bounded pull', function () {
  this.pull = this.cli('watch', '--all', '--next', '--timeout', '1')
  assert.equal(this.pull.status, 0, this.pull.stderr)
  this.pullToken = this.pull.stdout.match(/token ([0-9a-f]+)/)?.[1]
  assert.ok(this.pullToken, `pull did not offer a token:\n${this.pull.stdout}`)
})

Then('the pull offers the round without delivering it', function () {
  assert.match(this.pull.stdout, /REVIEW/)
  assert.equal(this.byNote('A').deliveredAt, null,
    'terminal output nobody claimed is not a delivery')
})

When('the agent claims the pull offer', function () {
  this.claim = this.cli('claim', ...this.subjectArgs(), '--token', this.pullToken,
    '--session', 'codex-test')
  assert.equal(this.claim.status, 0, this.claim.stderr)
})

Then('the pull claim delivers the round to session {string}', function (session) {
  assert.match(this.claim.stdout, /CLAIMED/)
  assert.ok(this.byNote('A').deliveredAt)
  assert.equal(this.byNote('A').deliveredTo, session)
})
