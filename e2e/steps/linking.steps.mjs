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
