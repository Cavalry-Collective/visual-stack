import { Given, Then, When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as agent from '../support/mock-agent.mjs'

/* ── subjects ── */

Given('a page is under review', async function () {
  await this.startFileReview()
})

Given('a page is under review with host {string}', async function (hostId) {
  await this.startFileReview(hostId)
})

Given('an app is running and under live review', async function () {
  await this.startLiveReview()
})

/* ── the reviewer's verbs ── */

const sendOne = async function (note) { await this.sendComment(note) }

Given('the reviewer has sent a comment {string}', sendOne)
When('the reviewer sends a comment {string}', sendOne)

Given('the reviewer has sent comments {string} and {string}', async function (a, b) {
  await this.sendComment(a)
  await this.sendComment(b)
})

const sendOnRoute = async function (note, route) { await this.sendComment(note, { route }) }

Given('the reviewer has sent a comment {string} on route {string}', sendOnRoute)
When('the reviewer sends a comment {string} on route {string}', sendOnRoute)

When('the reviewer replies {string} to {string}', async function (text, note) {
  const current = this.byNote(note)
  await this.post('/api/comments', {
    comments: [{ ...current, replies: [{ by: 'reviewer', text, at: new Date().toISOString() }] }],
  })
})

When('the reviewer withdraws {string}', async function (note) {
  const dismissed = await this.post('/api/comments/dismiss', { id: this.idFor(note) })
  assert.equal(dismissed.response.status, 200)
})

When('the reviewer clears all comments', async function () {
  this.versionsBeforeClear = this.versionFiles()
  const { comments } = await this.project()
  for (const comment of comments) {
    const dismissed = await this.post('/api/comments/dismiss', { id: comment.id })
    assert.equal(dismissed.response.status, 200, `the server takes ${comment.id} off the list`)
  }
})

When('the reviewer clears the history', async function () {
  const cleared = await this.post('/api/history/clear', {})
  assert.equal(cleared.response.status, 200)
})

When('the reviewer hard-resets the review', async function () {
  const reset = await this.post('/api/reset', {})
  assert.equal(reset.response.status, 200)
})

When('the reviewer approves the design expecting {int} open comments', async function (count) {
  const approved = await this.post('/api/approve', { expectedOpenCount: count })
  assert.equal(approved.response.status, 200, 'the sign-off is accepted')
})

/* ── the (mock) agent's verbs ── */

const delivery = function () { agent.takeDelivery(this) }
Given('the agent has taken delivery', delivery)
When('the agent takes delivery', delivery)

// One registration per expression: cucumber matches on text, not keyword.
When('the agent closes {string} and publishes {string}', function (note, label) {
  const run = agent.closeAndPublish(this, [note], label)
  assert.equal(run.status, 0, run.stderr)
})

When('the agent closes {string}, publishes {string} and summarises {string}',
  function (note, label, summary) {
    const run = agent.closeAndPublish(this, [note], label, summary)
    assert.equal(run.status, 0, run.stderr)
  })

When('the agent closes {string} again', function (note) {
  agent.closeAndPublish(this, [note])
})

When('the agent replies {string} to {string}', function (text, note) {
  agent.reply(this, note, text)
})

When('the agent edits the page', function () { this.editPage() })

Then('the agent can still close {string}', function (note) {
  const run = agent.closeAndPublish(this, [note])
  assert.equal(run.status, 0, run.stderr)
})

/* ── deliveries and the brief ── */

Then('the delivery names {int} open comment(s), {int} new', function (open, fresh) {
  assert.match(this.lastDelivery, new RegExp(`${open} open, ${fresh} new`),
    `delivery said:\n${this.lastDelivery}`)
})

Then('the brief lists {string} as new', function (note) {
  assert.ok(this.brief().includes(`### ${this.idFor(note)} · NEW`), 'the brief marks it new')
  assert.ok(this.brief().includes(note), 'the brief carries the note')
})

Then('the brief lists {string} as not new', function (note) {
  const id = this.idFor(note)
  assert.ok(this.brief().includes(`### ${id}`), 'the brief carries the comment')
  assert.ok(!this.brief().includes(`### ${id} · NEW`), 'without marking it new')
})

Then('the brief carries the reply {string}', function (text) {
  assert.ok(this.brief().includes(text), `the brief carries the thread:\n${this.brief()}`)
})

Then('the brief names the route {string} on {string}', function (route, note) {
  assert.ok(this.brief().includes(note), 'the brief carries the comment')
  assert.ok(this.brief().includes(`**Route** \`${route}\``), `the brief names the route:\n${this.brief()}`)
})

/* ── comment state ── */

Then('the comment {string} has been sent and delivered', function (note) {
  const comment = this.byNote(note)
  assert.ok(comment.sentAt, 'sent')
  assert.ok(comment.deliveredAt, 'delivered')
})

Then('the comment {string} is queued, not delivered', function (note) {
  const comment = this.byNote(note)
  assert.ok(comment.sentAt, 'sent')
  assert.equal(comment.deliveredAt, null, 'not delivered')
})

Then('the comment {string} is open', function (note) {
  assert.equal(this.byNote(note).state, 'open')
})

Then('the comment {string} is closed', function (note) {
  assert.equal(this.byNote(note).state, 'closed')
})

Then('the thread on {string} has an agent reply {string}', function (note, text) {
  const replies = this.byNote(note).replies
  assert.ok(replies.some(line => line.by === 'agent' && line.text === text),
    `the thread reads: ${JSON.stringify(replies)}`)
})

Then('nothing is left unanswered', function () {
  const run = agent.unanswered(this)
  assert.equal(run.status, 0, run.stdout)
})

Then('the workspace shows no comments', async function () {
  const { comments } = await this.project()
  assert.deepEqual(comments, [])
})

Then('no record remains of {string}', function (note) {
  assert.equal(this.stored().find(item => item.id === this.ids.get(note)), undefined)
})

Then('the record of {string} is closed and marked dismissed', function (note) {
  const comment = this.byNote(note)
  assert.equal(comment.state, 'closed')
  assert.ok(comment.dismissedAt)
})

Then('the comment {string} is still on the review', async function (note) {
  const { comments } = await this.project()
  assert.ok(comments.some(item => item.id === this.ids.get(note)))
})

/* ── versions ── */

Given('the review has reached version {int}', function (version) {
  while (this.state().version < version) {
    const run = this.cli('publish', ...this.subjectArgs(), '--label', `Version ${this.state().version + 1}`)
    assert.equal(run.status, 0, run.stderr)
  }
})

Then('the review is at version {int}', function (version) {
  assert.equal(this.state().version, version)
})

Then('the review is still at version {int}', function (version) {
  assert.equal(this.state().version, version)
})

Then('version {int} is a frozen copy of the page labelled {string}', function (version, label) {
  const frozen = fs.readFileSync(path.join(this.versionsDir, `v${version}.html`), 'utf8')
  assert.equal(frozen, fs.readFileSync(this.page, 'utf8'), 'the snapshot is the file as published')
  const meta = JSON.parse(fs.readFileSync(path.join(this.versionsDir, `v${version}.meta.json`), 'utf8'))
  assert.equal(meta.label, label)
})

Then('the version history is untouched', function () {
  assert.deepEqual(this.versionFiles(), this.versionsBeforeClear)
})

Then('only version {int} remains on the timeline', function (version) {
  assert.deepEqual(this.versionFiles(), [`v${version}.html`, `v${version}.meta.json`])
})

Then('the review starts again at version {int}', function (version) {
  assert.equal(this.state().version, version)
  assert.deepEqual(this.versionFiles(), [`v${version}.html`, `v${version}.meta.json`])
})

Then('the page keeps the agent\'s edits', function () {
  assert.ok(this.pageHasEdit(), 'nothing the agent changed is undone')
})

Then('no version file was frozen', function () {
  assert.ok(!this.versionFiles().some(file => file.endsWith('.html')),
    `nothing is snapshotted for a live review: ${this.versionFiles()}`)
})

/* ── requeue, approve, liveness ── */

Given('the agent\'s watching heartbeat is fresh', function () {
  fs.writeFileSync(path.join(this.store, 'watching'), String(Date.now()))
})

Given('nothing is listening', function () {
  fs.rmSync(path.join(this.store, 'watching'), { force: true })
})

When('the workspace asks to requeue', async function () {
  this.requeue = await this.post('/api/comments/requeue', {})
})

Then('the server refuses the requeue', function () {
  assert.equal(this.requeue.response.status, 409, 'nothing is taken off an agent that is listening')
})

Then('the approval records {int} open comments', function (count) {
  const approved = JSON.parse(fs.readFileSync(path.join(this.store, 'approved'), 'utf8'))
  assert.equal(approved.openComments.length, count)
})

Then('the server exits on its own', async function () {
  assert.ok(await this.waitForServerExit(), 'sign-off closes the server')
})

Then('the command succeeds', function () {
  assert.equal(this.lastRun.status, 0, this.lastRun.stderr)
})

/* ── host profile ── */

Then('the workspace injects the {string} profile named {string}', async function (hostId, name) {
  const workspace = await (await fetch(this.origin + this.base + '/')).text()
  assert.ok(workspace.includes(`window.__VSTACK_HOST__={"id":"${hostId}","name":"${name}"`),
    'the profile is stamped into the page')
})

Then('the injected share capability is {string}', async function (share) {
  const workspace = await (await fetch(this.origin + this.base + '/')).text()
  const injected = workspace.match(/window\.__VSTACK_HOST__=(\{.*?\})<\/script>/s)
  assert.ok(injected, 'the profile is on the page')
  assert.equal(JSON.parse(injected[1]).capabilities.share, share)
})

/* ── the app under a live review ── */

Then('the app is untouched', async function () {
  const response = await fetch(this.appOrigin + '/')
  assert.equal(response.status, 200)
  assert.match(await response.text(), /Fixture/)
})
