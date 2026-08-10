import { After, setDefaultTimeout, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(HERE, '../../plugins/vstack/skills/review/assets/review-server.mjs')

const PAGE_V1 = '<!doctype html><title>Review e2e page</title><main><h1 id="title">Todo</h1></main>'
const EDIT_MARKER = 'Todo — edited'

/* Two shapes of long page, because the canvas treats them differently and each
   one hid a bug. A page tall in pixels lets the frame grow to the whole
   document, so the canvas does the scrolling. A page sized in viewport units
   grows with the frame, so the fit gives up and the page keeps its own
   scrollbar — and then the frame's scroll and the canvas's disagree. */
const TAIL = '<p id="tail">The last thing on the page</p>'
const PAGE_TALL = `<!doctype html><title>Review e2e page</title><style>
  body{margin:0;position:relative;font:16px system-ui}
  #title{margin:0;padding:20px}#open-confirm{margin-left:20px}
  main{min-height:2400px}#tail{position:absolute;left:20px;top:2280px;margin:0}
  dialog{padding:20px}</style>
<main><h1 id="title">Todo</h1>
  <button id="open-confirm">Delete everything</button>${TAIL}</main>
<dialog id="confirm"><p id="confirm-text">Delete everything?</p>
  <button id="confirm-cancel">Cancel</button></dialog>
<script>
  const confirmEl = document.getElementById('confirm')
  document.getElementById('open-confirm').addEventListener('click', () => confirmEl.showModal())
  document.getElementById('confirm-cancel').addEventListener('click', () => confirmEl.close())
</script>`
const PAGE_SELF_SCROLL = `<!doctype html><title>Review e2e page</title><style>
  body{margin:0;position:relative;min-height:260vh;font:16px system-ui}
  #title{margin:0;padding:20px}#tail{position:absolute;left:20px;bottom:40px;margin:0}</style>
<main><h1 id="title">Todo</h1>${TAIL}</main>`

export const PAGES = { tall: PAGE_TALL, selfScroll: PAGE_SELF_SCROLL }

/* Scenarios run serially; each takes a pair of ports (review server + fixture
   app) so a slow teardown can never collide with the next scenario. */
let portCursor = 21000 + (process.pid % 400) * 20

export class ReviewWorld {
  constructor () {
    this.hostId = process.env.VSTACK_HOST || 'claude'
    this.temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-e2e-'))
    this.port = (portCursor += 2)
    this.live = false
    this.server = null
    this.serverLog = ''
    this.app = null
    this.ids = new Map()
    this.nextId = 0
    this.lastDelivery = ''
    this.lastRun = null
  }

  get origin () { return `http://127.0.0.1:${this.port}` }
  get base () { return this.live ? '/__review' : '' }
  get store () { return path.join(this.temp, '.vstack', 'local', 'review', this.name) }
  get versionsDir () { return path.join(this.store, 'versions') }

  subjectArgs () { return this.live ? ['--name', this.name] : ['--file', this.page] }

  cli (...argv) {
    const run = spawnSync(process.execPath, [SERVER, ...argv], {
      encoding: 'utf8', cwd: this.temp, timeout: 30_000,
    })
    this.lastRun = run
    return run
  }

  async startFileReview (hostId = this.hostId, html = PAGE_V1) {
    this.live = false
    this.name = 'page'
    this.page = path.join(this.temp, 'page.html')
    fs.writeFileSync(this.page, html)
    const published = this.cli('publish', ...this.subjectArgs(), '--label', 'Initial version')
    assert.equal(published.status, 0, published.stderr)
    await this.serve(['--file', this.page], hostId)
  }

  async startLiveReview () {
    this.live = true
    this.name = 'testapp'
    const appPort = this.port + 1
    const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    this.app = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(`<!doctype html><title>Fixture</title><h1>${escapeHtml(req.url)}</h1><a href="/settings">Settings</a>`)
    })
    await new Promise(resolve => this.app.listen(appPort, '127.0.0.1', resolve))
    this.appOrigin = `http://127.0.0.1:${appPort}`
    await this.serve(['--app', this.appOrigin, '--name', this.name], this.hostId)
  }

  async serve (subject, hostId) {
    this.server = spawn(process.execPath, [
      SERVER, 'serve', ...subject, '--port', String(this.port),
      '--idle-timeout', '0', '--host', hostId, '--no-open',
    ], { cwd: this.temp, stdio: ['ignore', 'pipe', 'pipe'] })
    this.server.stdout.on('data', chunk => { this.serverLog += chunk })
    this.server.stderr.on('data', chunk => { this.serverLog += chunk })
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(this.origin + this.base + '/api/project')).ok) return
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`review server did not start:\n${this.serverLog}`)
  }

  async post (pathname, body) {
    const response = await fetch(this.origin + this.base + pathname, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { response, body: await response.json().catch(() => null) }
  }

  async project () {
    const response = await fetch(this.origin + this.base + '/api/project')
    assert.ok(response.ok, 'the workspace API answers')
    return response.json()
  }

  idFor (note) {
    if (!this.ids.has(note)) this.ids.set(note, `c${++this.nextId}`)
    return this.ids.get(note)
  }

  /** What the workspace saves for one comment. `sentAt` set means "let go of it". */
  commentPayload (note, extra = {}) {
    return { id: this.idFor(note), kind: 'area', note, size: 'desktop', replies: [], ...extra }
  }

  async sendComment (note, extra = {}) {
    const saved = await this.post('/api/comments', {
      comments: [this.commentPayload(note, { sentAt: new Date().toISOString(), ...extra })],
    })
    assert.equal(saved.response.status, 200, 'the workspace save is accepted')
  }

  stored () {
    const file = path.join(this.store, 'comments.json')
    if (!fs.existsSync(file)) return []
    return JSON.parse(fs.readFileSync(file, 'utf8')).comments
  }

  /** A comment made through the workspace mints its own id, so fall back to
      the note's words and remember what the workspace called it. */
  byNote (note) {
    let comment = this.stored().find(item => item.id === this.ids.get(note))
    comment ??= this.stored().find(item => item.note === note)
    assert.ok(comment, `comment "${note}" exists on the review`)
    this.ids.set(note, comment.id)
    return comment
  }

  brief () { return fs.readFileSync(path.join(this.store, 'brief.md'), 'utf8') }

  state () { return JSON.parse(fs.readFileSync(path.join(this.store, 'state.json'), 'utf8')) }

  versionFiles () {
    if (!fs.existsSync(this.versionsDir)) return []
    return fs.readdirSync(this.versionsDir).sort()
  }

  editPage () {
    fs.writeFileSync(this.page, fs.readFileSync(this.page, 'utf8').replace('Todo', EDIT_MARKER))
  }

  pageHasEdit () { return fs.readFileSync(this.page, 'utf8').includes(EDIT_MARKER) }

  /** The long-lived watcher a real session runs, its stdout kept as one
      growing transcript so steps can wait for the next protocol line. */
  startStreamWatcher () {
    this.watcher = spawn(process.execPath, [SERVER, 'watch', '--all', '--stream'], {
      cwd: this.temp, stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.watcherOut = ''
    this.watcher.stdout.on('data', chunk => { this.watcherOut += chunk })
    this.watcher.stderr.on('data', chunk => { this.watcherOut += chunk })
  }

  async watcherSays (pattern, timeout = 10_000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const match = this.watcherOut.match(pattern)
      if (match) return match
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`the watcher never said ${pattern}:\n${this.watcherOut}`)
  }

  async waitForServerExit () {
    for (let attempt = 0; attempt < 50 && this.server.exitCode === null; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return this.server.exitCode !== null
  }

  teardown () {
    this.watcher?.kill('SIGTERM')
    this.server?.kill('SIGTERM')
    this.app?.close()
    fs.rmSync(this.temp, { recursive: true, force: true })
  }
}

setWorldConstructor(ReviewWorld)
setDefaultTimeout(60_000)

After(function () { this.teardown() })
