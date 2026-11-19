import { Given, Then, When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as agent from '../support/mock-agent.mjs'
import { PAGES } from '../support/world.mjs'

const START_PAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../../plugins/vstack/skills/polish/assets/review-start.html')
const BRIDGE_CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../plugins/vstack/lib/json-bridge.mjs')
const REPORT_TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../../plugins/vstack/skills/polish/assets/report-template.html')

const HOST_NAMES = { claude: 'Claude', codex: 'Codex' }

/** Poll an assertion until it holds — the library-mode stand-in for test-runner expect. */
async function eventually (check, what, timeout = 5000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeout) {
    try { return await check() } catch (error) { lastError = error }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`${what}\n${lastError}`)
}

/** Click the canvas over the page's heading. The canvas is CSS-scaled, so the
    click goes through the mouse at the overlay's on-screen box, not through an
    element-relative position that a transform would misplace. */
async function clickCanvas (world) {
  const overlay = world.browserPage.locator('#overlay')
  await overlay.waitFor()
  const box = await overlay.boundingBox()
  await world.browserPage.mouse.click(box.x + box.width / 8, box.y + 30)
}

When('the reviewer opens the workspace', async function () {
  await this.browserPage.goto(this.origin + this.base + '/')
  await this.browserPage.locator('#frame').waitFor()
})

Then('the tab is titled for the review of {string}', async function (name) {
  await eventually(async () => {
    const title = await this.browserPage.title()
    assert.ok(title.includes(`${name} — Review`), `tab says "${title}"`)
  }, `the tab is titled for ${name}`)
})

Then('the framed page shows the heading {string}', async function (heading) {
  const framed = this.browserPage.frameLocator('#frame').locator('#title')
  await framed.waitFor()
  assert.equal((await framed.textContent()).trim(), heading)
})

Then('the send button is labelled for the host', async function () {
  const label = await this.browserPage.locator('#btnSend').textContent()
  assert.ok(label.includes(HOST_NAMES[this.hostId]),
    `"${label}" names the ${this.hostId} profile`)
})

When('the reviewer clicks the page and writes {string}', async function (note) {
  await clickCanvas(this)
  const editor = this.browserPage.locator('#composer textarea.cnote')
  await editor.waitFor()
  await editor.fill(note)
  await editor.press('Enter')
  await eventually(() => { this.byNote(note) }, 'the comment reaches the server')
})

When('the reviewer clicks the page and dismisses the empty note', async function () {
  await clickCanvas(this)
  await this.browserPage.locator('#composer textarea.cnote').waitFor()
  await this.browserPage.keyboard.press('Escape')
})

Then('a pin marks the comment on the canvas', async function () {
  await this.browserPage.locator('#overlay .mark').first().waitFor()
})

Then('the canvas shows no pins', async function () {
  await eventually(async () => {
    const marks = this.browserPage.locator('#overlay .mark')
    for (let i = 0; i < await marks.count(); i++) {
      assert.equal(await marks.nth(i).isVisible(), false, 'a mark is still visible')
    }
  }, 'every pin is off the canvas')
})

Then('the comment {string} is a draft on the review', async function (note) {
  // The save is a request in flight, so give it the moment it needs to land.
  await eventually(() => {
    assert.equal(this.byNote(note).sentAt, null, 'still being written, not sent')
  }, `"${note}" is on the review as a draft`)
})

Then('the review has no comments on disk', function () {
  const withWords = this.stored().filter(comment => String(comment.note || '').trim())
  assert.deepEqual(withWords, [])
})

When('the reviewer switches to View', async function () {
  await this.browserPage.locator('#modeSwitch button', { hasText: 'View' }).click()
})

When('the reviewer presses Send', async function () {
  const note = [...this.ids.keys()].at(-1)
  await this.browserPage.locator('#btnSend').click()
  await eventually(() => {
    assert.ok(this.byNote(note).sentAt, 'sending stamps the comment')
  }, 'the send reaches the server')
})

/* ── the banner that announces a finished round ── */

Then('the banner says the round is done and shows {string}', async function (summary) {
  const banner = this.browserPage.locator('#workBanner.on')
  await banner.waitFor()
  const headline = await banner.locator('#workText').textContent()
  assert.doesNotMatch(headline, /v\d|Round \d/, `the headline still names a version: "${headline}"`)
  await eventually(async () => {
    assert.equal(await banner.locator('#workSummary').isVisible(), true, 'the summary is shown')
    assert.equal((await banner.locator('#workSummaryText').textContent()).trim(), summary)
  }, 'the summary reaches the banner')
})

When('the reviewer presses the summary chevron', async function () {
  await this.browserPage.locator('#btnSummary').click()
})

Then('the summary is folded away behind the chevron', async function () {
  await eventually(async () => {
    assert.equal(await this.browserPage.locator('#workSummary').isVisible(), false, 'still shown')
    const chevron = this.browserPage.locator('#btnSummary')
    assert.equal(await chevron.isVisible(), true, 'no way back to it')
    assert.equal(await chevron.getAttribute('aria-expanded'), 'false')
  }, 'the summary folds away')
})

Then('the banner carries {string} with it folded away', async function (summary) {
  await eventually(async () => {
    assert.equal((await this.browserPage.locator('#workSummaryText').textContent()).trim(), summary)
    assert.equal(await this.browserPage.locator('#workSummary').isVisible(), false, 'it opened itself')
    assert.equal(await this.browserPage.locator('#btnSummary').isVisible(), true, 'no chevron to open it')
  }, 'the next round arrives folded the way it was left')
})

Then('the summary is open', async function () {
  await eventually(async () => {
    assert.equal(await this.browserPage.locator('#workSummary').isVisible(), true, 'still folded')
    assert.equal(await this.browserPage.locator('#btnSummary').getAttribute('aria-expanded'), 'true')
  }, 'the summary is open')
})

/* ── a question with answers to pick from ── */

When('the agent asks {string} on {string} offering {string} and {string}, recommending {int}',
  function (text, note, first, second, recommend) {
    agent.askWithOptions(this, note, text, [first, second], recommend)
  })

Then('the comment offers {string} and {string}, with {string} recommended',
  async function (first, second, recommended) {
    const choices = this.browserPage.locator('.item .choice')
    await eventually(async () => {
      assert.equal(await choices.count(), 2, 'both options are offered')
    }, 'the options reach the comment')
    assert.deepEqual(
      (await this.browserPage.locator('.item .choice > span').allInnerTexts())
        .map(t => t.trim()),
      [first, second])
    const marked = this.browserPage.locator('.item .choice.rec')
    assert.equal(await marked.count(), 1, 'exactly one is recommended')
    assert.match(await marked.innerText(), new RegExp(recommended))
    assert.match(await marked.innerText(), /Recommended/i)
  })

When('the reviewer picks {string}', async function (option) {
  await this.browserPage.locator('.item .choice', { hasText: option }).click()
})

Then('the thread ends with {string} from the reviewer', async function (text) {
  await eventually(async () => {
    const { comments } = await this.project()
    const last = comments.flatMap(c => c.replies || []).at(-1)
    assert.equal(last?.text, text)
    assert.equal(last?.by, 'reviewer')
  }, 'the pick is posted as the answer')
})

/* ── the comments panel: what it is worth typing in, and how wide it is ── */

When('the reviewer adds a general comment {string}', async function (note) {
  await this.browserPage.locator('#btnGeneral').click()
  const editor = this.browserPage.locator('.item .gnote')
  await editor.waitFor()
  await editor.fill(note)
  await editor.press('Enter')
  await eventually(() => { this.byNote(note) }, 'the comment reaches the server')
})

When('the reviewer starts a general comment {string}', async function (note) {
  await this.browserPage.locator('#btnGeneral').click()
  const editor = this.browserPage.locator('.item .gnote')
  await editor.waitFor()
  await editor.fill(note)
})

When('the reviewer saves it with Enter', async function () {
  await this.browserPage.locator('.item .gnote').press('Enter')
})

Then('the general comment editor is closed', async function () {
  await eventually(async () => {
    assert.equal(await this.browserPage.locator('.item .gnote').count(), 0, 'the box is still open')
  }, 'Enter closes the box it was pressed in')
})

Then('the general comment editor offers Save and the newline hint', async function () {
  const card = this.browserPage.locator('.item', { has: this.browserPage.locator('.gnote') })
  assert.ok(await card.locator('.gsave').isVisible(), 'the Save button is there')
  const hint = await card.locator('.gfoot .hint').textContent()
  assert.match(hint, /Shift\+Enter/, `the hint reads "${hint}"`)
})

const panelWidth = world =>
  world.browserPage.locator('#panel').evaluate(el => el.getBoundingClientRect().width)

When('the reviewer drags the panel edge {int}px wider', async function (by) {
  this.panelWas = await panelWidth(this)
  const grip = await this.browserPage.locator('#panelGrip').boundingBox()
  const y = grip.y + grip.height / 2
  await this.browserPage.mouse.move(grip.x + grip.width / 2, y)
  await this.browserPage.mouse.down()
  await this.browserPage.mouse.move(grip.x + grip.width / 2 - by, y, { steps: 8 })
  await this.browserPage.mouse.up()
})

Then('the comments panel is {int}px wider', async function (by) {
  await eventually(async () => {
    const now = await panelWidth(this)
    assert.ok(Math.abs(now - this.panelWas - by) <= 2,
      `it went from ${Math.round(this.panelWas)} to ${Math.round(now)}`)
    this.panelExpect = now
  }, 'the panel follows the drag')
})

Then('the comments panel keeps its width', async function () {
  await eventually(async () => {
    const now = await panelWidth(this)
    assert.ok(Math.abs(now - this.panelExpect) <= 2,
      `it came back at ${Math.round(now)}, not ${Math.round(this.panelExpect)}`)
  }, 'the width survives a reload')
})

/* ── long pages: the canvas scroll, the page's own scroll, and overlays ── */

Given('a long page is under review', async function () {
  await this.startFileReview(this.hostId, PAGES.tall)
})

Given('a page that keeps its own scrollbar is under review', async function () {
  await this.startFileReview(this.hostId, PAGES.selfScroll)
})

/** The window inside the frame. It scrolls on its own whenever fitting the
    frame to the page would only make the page taller. */
async function framedWindow (world) {
  const handle = await world.browserPage.locator('#frame').elementHandle()
  return handle.contentFrame()
}

/** Where an element of the page under review is on screen. The canvas is
    CSS-scaled, so aiming the mouse at anything means measuring it first. */
async function framedBox (world, selector) {
  const target = world.browserPage.frameLocator('#frame').locator(selector)
  await target.waitFor()
  const box = await target.boundingBox()
  assert.ok(box, `${selector} is on screen`)
  return box
}

/* Both scrolls are re-applied on every attempt rather than done once and then
   waited on. Until the page under review has laid out there is nothing to
   scroll, and a scroll made at that moment is dropped rather than queued — so
   an attempt that observes without repeating the scroll can never recover.

   Each one waits to be at the bottom and to have stayed there, not merely to
   have moved. The bottom keeps moving while the page lays out, and a step that
   stops at the first sign of movement leaves what it scrolled to off screen,
   where the click that follows cannot reach it. */

/** The workspace sizes the frame to the page once that page has loaded, so the
    canvas has no final extent before then. Waiting for the size it set is what
    tells a step the layout it is about to scroll or measure has arrived. */
async function framedPageIsFitted (world) {
  await eventually(async () => {
    const height = await world.browserPage.locator('#frame').evaluate(frame =>
      frame.contentDocument?.readyState === 'complete' ? parseFloat(frame.style.height) || 0 : 0)
    assert.ok(height > 0, 'the workspace has not sized the frame to the page')
  }, 'the workspace sizes the frame to the page')
}

/** Scroll to the bottom and confirm it got there. `reach` scrolls and reports
    where it landed and where the bottom is, in the same evaluation. */
async function scrolledToTheBottom (reach, what) {
  await eventually(async () => {
    const { at, end } = await reach()
    assert.ok(end > 0, `${what} did not scroll`)
    assert.ok(Math.abs(at - end) <= 1, `${what} is not at the bottom`)
  }, `${what} scrolls to the bottom`)
}

When('the reviewer scrolls the framed page to the bottom', async function () {
  await framedPageIsFitted(this)
  const framed = await framedWindow(this)
  await scrolledToTheBottom(() => framed.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight)
    return { at: window.scrollY, end: document.documentElement.scrollHeight - window.innerHeight }
  }), 'the page under review')
})

When('the reviewer scrolls the canvas to the bottom', async function () {
  await framedPageIsFitted(this)
  const port = this.browserPage.locator('#viewportBox')
  await scrolledToTheBottom(() => port.evaluate(element => {
    element.scrollTop = element.scrollHeight
    return { at: element.scrollTop, end: element.scrollHeight - element.clientHeight }
  }), 'the canvas')
})

When('the reviewer clicks {string} in the framed page and writes {string}',
  async function (selector, note) {
    const box = await framedBox(this, selector)
    await this.browserPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const editor = this.browserPage.locator('#composer textarea.cnote')
    await editor.waitFor()
    await editor.fill(note)
    await editor.press('Enter')
    await eventually(() => { this.byNote(note) }, 'the comment reaches the server')
  })

Then('the comment {string} is anchored to {string}', function (note, id) {
  const comment = this.byNote(note)
  assert.ok(comment.anchor, `"${note}" attached to an element`)
  assert.equal(comment.anchor.id, id,
    `it attached to <${comment.anchor.tag}${comment.anchor.id ? ' id=' + comment.anchor.id : ''}>`)
})

When('the framed page opens its confirmation dialog', async function () {
  await this.browserPage.frameLocator('#frame').locator('#open-confirm').click()
  await eventually(async () => {
    assert.ok(await this.browserPage.frameLocator('#frame').locator('#confirm').isVisible(),
      'the dialog never opened')
  }, 'the dialog opens')
})

When('the framed page closes its confirmation dialog', async function () {
  await this.browserPage.frameLocator('#frame').locator('#confirm-cancel').click()
})

Then('the dialog is where the reviewer is looking', async function () {
  await eventually(async () => {
    const dialog = await framedBox(this, '#confirm')
    const port = await this.browserPage.locator('#viewportBox').boundingBox()
    const bottom = port.y + port.height
    assert.ok(dialog.y >= port.y - 2 && dialog.y + dialog.height <= bottom + 2,
      `the dialog runs ${Math.round(dialog.y)}–${Math.round(dialog.y + dialog.height)} ` +
      `and the canvas shows ${Math.round(port.y)}–${Math.round(bottom)}`)
  }, 'the dialog is on screen')
})

Then('the canvas fits the whole page again', async function () {
  await eventually(async () => {
    const framed = await framedWindow(this)
    const pageHeight = await framed.evaluate(() => document.documentElement.scrollHeight)
    const frameHeight = await this.browserPage.locator('#frame').evaluate(el => el.offsetHeight)
    assert.ok(Math.abs(frameHeight - pageHeight) <= 4,
      `the frame is ${frameHeight}px for a ${pageHeight}px page`)
  }, 'the frame goes back to the height of the page')
})

When('the framed page grows', async function () {
  this.canvasScrollWas = await this.browserPage.locator('#viewportBox').evaluate(element => element.scrollTop)
  const framed = await framedWindow(this)
  await framed.evaluate(() => { document.querySelector('main').style.minHeight = '2800px' })
})

Then('the canvas has not moved', async function () {
  const now = await this.browserPage.locator('#viewportBox').evaluate(element => element.scrollTop)
  assert.ok(Math.abs(now - this.canvasScrollWas) <= 1,
    `the canvas was at ${this.canvasScrollWas} and is now at ${now}`)
})

When('the reviewer opens Clear all', async function () {
  await this.browserPage.locator('#btnClear').click()
  await this.browserPage.locator('#clearDialog[open]').waitFor()
})

When('the reviewer chooses to clear the open ones too', async function () {
  await this.browserPage.locator('#clearOpenToo').check()
})

When('the reviewer confirms clearing', async function () {
  await this.browserPage.locator('#btnConfirmClear').click()
  await this.browserPage.locator('#clearDialog[open]').waitFor({ state: 'detached' })
})

Then('the workspace still shows the comment {string}', async function (note) {
  await eventually(async () => {
    const { comments } = await this.project()
    assert.ok(comments.some(comment => comment.note === note), `"${note}" was taken off`)
  }, `"${note}" stays on the list`)
})

/* Earlier holds what was closed more than a minute ago, folded away. A comment
   the agent closed just now belongs above it, where the reviewer can check it. */
Then('nothing is folded into Earlier', async function () {
  const panel = await this.browserPage.locator('#pbody').innerText()
  assert.doesNotMatch(panel, /Earlier/i, `the panel reads:\n${panel}`)
})

/* The Addressed group starts folded, so its heading is what says the round
   landed — the cards inside it are not in the DOM until it is opened. */
Then('the workspace shows {int} comment(s) as addressed', async function (n) {
  await eventually(async () => {
    const panel = await this.browserPage.locator('#pbody').innerText()
    assert.match(panel, new RegExp(`Addressed \\(${n}\\)`, 'i'), `the panel reads:\n${panel}`)
  }, 'the panel shows the addressed group')
})

When('the reviewer clears all comments from the workspace', async function () {
  await this.browserPage.locator('#btnClear').click()
  const confirm = this.browserPage.locator('#clearDialog #btnConfirmClear')
  await confirm.waitFor()
  await confirm.click()
  await eventually(async () => {
    const { comments } = await this.project()
    assert.equal(comments.length, 0)
  }, 'the list empties')
})

/* ── handing a queued comment out to a subagent ── */

/** The card for one comment. The panel is rebuilt on every change, so it is
    found by the id the review holds rather than by a node kept from earlier. */
const cardFor = (world, note) =>
  world.browserPage.locator(`.item[data-id="${world.idFor(note)}"]`)

Then('the hand-out control on {string} is {word}', async function (note, shown) {
  const control = cardFor(this, note).locator('.idelegate')
  await cardFor(this, note).waitFor()
  await eventually(async () => {
    assert.equal(await control.count(), shown === 'shown' ? 1 : 0,
      `the control is ${shown === 'shown' ? 'missing' : 'there'}`)
  }, `the hand-out control on "${note}" is ${shown}`)
})

When('the reviewer hands {string} out to a subagent', async function (note) {
  await cardFor(this, note).locator('.idelegate').click()
  await eventually(() => {
    assert.ok(this.byNote(note).delegatedAt, 'the server records the hand-out')
  }, 'the hand-out reaches the server')
})

Then('the workspace shows {string} as work in flight', async function (note) {
  await eventually(async () => {
    const classes = await cardFor(this, note).getAttribute('class')
    assert.match(classes, /\bworking\b/, `the card reads "${classes}"`)
  }, `the panel shows "${note}" as work in flight`)
})

/* ── Parallel mode: every comment handed out as it is sent ── */

Then('the Parallel mode setting is {word}', async function (shown) {
  await this.browserPage.locator('#settingsBtn').click()
  const row = this.browserPage.locator('#cogParallelRow')
  await eventually(async () => {
    assert.equal(await row.isVisible(), shown === 'shown', `the setting is ${shown === 'shown' ? 'missing' : 'there'}`)
  }, `the setting is ${shown}`)
})

When('the reviewer turns on Parallel mode', async function () {
  await this.browserPage.locator('#settingsBtn').click()
  const box = this.browserPage.locator('#parallelMode')
  await box.check()
  assert.equal(await box.isChecked(), true)
  await this.browserPage.locator('#settingsBtn').click()
})

Then('the server records {string} as handed out', async function (note) {
  await eventually(() => {
    assert.ok(this.byNote(note).delegatedAt, 'the server records the hand-out')
  }, `"${note}" is handed out`)
})

/* ── a Polish report, answered in its own tab ── */

Given('a Polish review is started on its own', async function () {
  await this.startReportServer(fs.readFileSync(START_PAGE, 'utf8'), { stage: 'choose', decisions: {}, overall: '', revised: {} })
})

When('the reviewer opens the review', async function () {
  await this.browserPage.goto(this.reportUrl)
  await this.browserPage.locator('.panel[data-level="clean"]').waitFor()
})

When('the reviewer switches the review to 中文', async function () {
  await this.browserPage.locator('#settingsBtn').click()
  await this.browserPage.locator('#settingsMenu [data-lang="zh"]').click()
  await this.browserPage.keyboard.press('Escape')
})

Then('the level panels read in 中文', async function () {
  await eventually(async () => {
    assert.match(await this.browserPage.locator('.panel[data-level="showcase"]').textContent(), /惊艳/)
  }, 'the Showcase panel reads 惊艳')
})

When('the reviewer picks the level {string}', async function (level) {
  await this.browserPage.locator(`.panel[data-level="${level}"]`).click()
})

Then('the answers file holds the level {string} in {string}', async function (level, lang) {
  await eventually(() => {
    const doc = this.answers()
    assert.equal(doc.level, level)
    assert.equal(doc.lang, lang)
  }, `the answers file holds ${level} in ${lang}`)
})

When('the agent lists {int} tasks and ticks the first', async function (count) {
  const doc = this.answers()
  doc.stage = 'audit'
  doc.tasks = Array.from({ length: count }, (_, index) => ({ id: `task-${index + 1}`, text: { en: `Task ${index + 1}`, zh: `任务 ${index + 1}` }, done: false }))
  fs.writeFileSync(this.answersFile, JSON.stringify(doc, null, 2))
  const tick = spawnSync(process.execPath, [BRIDGE_CLI, 'patch', '--json', this.answersFile, '--id', 'task-1', '--set', 'done=true'])
  assert.equal(tick.status, 0, String(tick.stderr))
})

Then('the review shows {int} of {int} tasks done', async function (done, total) {
  await eventually(async () => {
    assert.equal(await this.browserPage.locator('#progress input[type="checkbox"]').count(), total)
    assert.equal(await this.browserPage.locator('#progress input[type="checkbox"]:checked').count(), done)
  }, `${done} of ${total} tasks are ticked`)
})

When('the agent stops with a problem', async function () {
  fs.writeFileSync(this.answersFile, JSON.stringify({ ...this.answers(), problem: '请先登录网站。' }, null, 2))
  await this.browserPage.locator('#problem:not([hidden])').waitFor({ timeout: 5000 })
})

When('the reviewer presses Retry', async function () {
  await this.browserPage.locator('#retry').click()
})

Then('the answers file asks the agent to retry', async function () {
  await eventually(() => {
    const doc = this.answers()
    assert.equal(doc.retry, true)
    assert.equal(doc.problem, '')
  }, 'the answers file holds retry and no problem')
  await this.browserPage.locator('#problem').waitFor({ state: 'hidden', timeout: 5000 })
  const doc = this.answers()
  delete doc.retry
  fs.writeFileSync(this.answersFile, JSON.stringify(doc, null, 2))
})

When('the agent publishes the report', async function () {
  fs.writeFileSync(this.reportPage, fs.readFileSync(REPORT_TEMPLATE, 'utf8'))
  fs.writeFileSync(this.answersFile, JSON.stringify({ ...this.answers(), stage: 'report' }, null, 2))
})

Then('the same tab shows the report in 中文', async function () {
  await this.browserPage.locator('#f-example .decide').waitFor({ timeout: 5000 })
  assert.equal((await this.browserPage.locator('#f-example .decide [data-d="approve"]').textContent()).trim(), '批准')
  assert.equal((await this.browserPage.locator('#f-example h2').innerText()).trim(), '六个词以内的标题')
})

Then('the answers file still holds the level {string}', async function (level) {
  await eventually(() => { assert.equal(this.answers().level, level) }, `the level ${level} survives a send`)
})

Given('a Polish report is served on its own', async function () {
  await this.startReportServer(fs.readFileSync(REPORT_TEMPLATE, 'utf8'))
})

When('the reviewer opens the report', async function () {
  await this.browserPage.goto(this.reportUrl)
  await this.browserPage.locator('#f-example .decide').waitFor()
})

// The report shows one section at a time; a reviewer reaches another through the index.
async function openSection (page, id) {
  if (!(await page.locator(`#${id}`).isVisible())) await page.locator(`#toc a[data-ref="${id}"]`).click()
  await page.locator(`#${id}.current`).waitFor()
}

When('the reviewer approves the section {string}', async function (id) {
  await openSection(this.browserPage, id)
  await this.browserPage.locator(`#${id} .decide [data-d="approve"]`).click()
})

When('the reviewer steers the section {string} without a note', async function (id) {
  await openSection(this.browserPage, id)
  await this.browserPage.locator(`#${id} .steer-link`).click()
})

When('the reviewer adds the note {string} to {string}', async function (note, id) {
  await this.browserPage.locator(`#${id} .steer textarea`).fill(note)
})

Then('the report asks for a note on {string}', async function (id) {
  assert.equal((await this.browserPage.locator(`#${id} .steer label`).innerText()).trim(), 'What should change?')
  await this.browserPage.locator(`#${id}.current [data-steer-state].needed`).waitFor()
  await this.browserPage.locator(`#${id} .steer textarea:focus`).waitFor()
  assert.equal(this.answers().decisions?.[id], undefined, 'nothing was sent')
})

// Below 1100 px the findings list is a drawer from the left, behind a handle on its edge.
When('on a phone the reviewer picks {string} from the findings drawer', async function (id) {
  const page = this.browserPage
  this.wideViewport = page.viewportSize()
  await page.setViewportSize({ width: 375, height: 667 })
  await eventually(async () => { assert.equal(await page.locator('#rail').isVisible(), false, 'the drawer starts closed') }, 'the drawer is tucked away')
  assert.equal(await page.locator('#railBadge').innerText(), '1', 'the handle counts the unanswered finding')
  await page.locator('#railHandle').click()
  await page.locator('#rail.open').waitFor()
  await eventually(async () => { assert.ok(await page.locator('#rail').isVisible(), 'the drawer opens') }, 'the drawer slides in')
  await page.locator(`#rail a[data-ref="${id}"]`).click()
})

Then('the drawer closes on the section {string}', async function (id) {
  const page = this.browserPage
  await page.locator(`#${id}.current`).waitFor()
  assert.equal(await page.locator('#rail.open').count(), 0, 'the drawer closes')
  assert.equal(await page.locator('#railScrim').isVisible(), false, 'the shade goes')
  await page.setViewportSize(this.wideViewport)
  assert.equal(await page.locator('#railHandle').isVisible(), false, 'a wide screen shows the list beside the page')
})

When('the reviewer opens a picture full size and goes back', async function () {
  await this.browserPage.locator('.finding.current .shot.zoom').first().click()
  await this.browserPage.locator('#lightbox[open]').waitFor()
  await this.browserPage.goBack()
})

Then('the picture closes and the report stays open', async function () {
  await this.browserPage.locator('#lightbox:not([open])').waitFor({ state: 'attached' })
  await this.browserPage.locator('.finding.current').waitFor()
})

When('the reviewer opens the ▾ menu and presses Esc', async function () {
  await this.browserPage.locator('#moreBtn').click()
  await this.browserPage.locator('#moreMenu:not([hidden])').waitFor()
  await this.browserPage.keyboard.press('Escape')
})

Then('the ▾ menu is closed', async function () {
  await this.browserPage.locator('#moreMenu').waitFor({ state: 'hidden' })
})

When('the reviewer presses the right arrow key', async function () {
  await this.browserPage.keyboard.press('ArrowRight')
})

When('the reviewer steers the section {string} with {string}', async function (id, note) {
  await openSection(this.browserPage, id)
  await this.browserPage.locator(`#${id} .steer-link`).click()
  await this.browserPage.locator(`#${id} .steer textarea`).fill(note)
})

When('the reviewer shows the variation {string} of {string}', async function (name, id) {
  await openSection(this.browserPage, id)
  // Each Proposed caption carries the tabs; the one on show is the one to press.
  await this.browserPage.locator(`#${id} .side.prop:not([hidden]) .variants button[data-v="${name}"]`).click()
})

// Two buttons answer a section; Steer is a link beside them, and variations are asked for inside Steer.
Then('the bar offers Approve and Reject, with Steer as a link', async function () {
  const order = await this.browserPage.locator('#f-example .decide button').evaluateAll(buttons => buttons.map(button => button.dataset.d))
  assert.deepEqual(order, ['approve', 'reject'])
  assert.equal((await this.browserPage.locator('#f-example .steer-link').innerText()).trim(), 'Steer')
})

Then('Approve on {string} says only Approve', async function (id) {
  assert.equal((await this.browserPage.locator(`#${id} .decide [data-d="approve"]`).innerText()).trim(), 'Approve')
})

When('the reviewer asks for more variations of {string}', async function (id) {
  await openSection(this.browserPage, id)
  await this.browserPage.locator(`#${id} .steer-link`).click()
  await this.browserPage.locator(`#${id}.steer-open .vary-link`).click()
  assert.equal(await this.browserPage.locator(`#${id}.steer-open`).count(), 0, 'asking for variations needs no note')
})

When('the reviewer sends the answers', async function () {
  await this.browserPage.locator('#sendBtn').click()
  await this.browserPage.locator('.vs-toast.on').waitFor()
})

When('the agent revises the section {string}', async function (id) {
  const sent = this.answers()
  fs.writeFileSync(this.reportPage, fs.readFileSync(this.reportPage, 'utf8').replace('<h2>Drag to compare</h2>', '<h2>Drag the bigger handle</h2>'))
  const note = sent.decisions[id].note
  delete sent.decisions[id]
  sent.revised = { ...sent.revised, [id]: note }
  fs.writeFileSync(this.answersFile, JSON.stringify(sent, null, 2))
})

When('the reviewer shows the revision', async function () {
  await this.browserPage.locator('#pushbar.on').waitFor({ timeout: 5000 })
  await this.browserPage.locator('#pushShow').click()
  await this.browserPage.waitForLoadState('load')
})

// The last slide carries the finish itself, beside a Send that shows only while something is unsent.
When('the reviewer presses Approve & finish twice on the last slide', async function () {
  const page = this.browserPage
  await page.locator('#nextBtn').click()
  await page.locator('#nextBtn').click()
  await page.locator('#nextBtn').click()
  await page.locator('.closing.current').waitFor()
  await eventually(async () => { assert.equal(await page.locator('#closingSend').isVisible(), false, 'nothing is left to send') }, 'Send hides once everything is sent')
  assert.match(await page.locator('[data-closing-text]').innerText(), /Builds the 1 approved/)
  await page.locator('#closingFinish').click()
  assert.match(await page.locator('#closingFinish').innerText(), /Press again/)
  await page.locator('#closingFinish').click()
})

Then('the answers file approves {string}', async function (id) {
  await eventually(() => {
    assert.equal(this.answers().decisions[id]?.choice, 'approve')
  }, `${id} is approved in the answers file`)
})

Then('the answers file steers {string} with {string}', async function (id, note) {
  await eventually(() => {
    assert.deepEqual(this.answers().decisions[id], { choice: 'steer', note })
  }, `${id} is steered in the answers file`)
})

Then('the answers file approves {string} with the variation {string}', async function (id, name) {
  await eventually(() => {
    assert.deepEqual(this.answers().decisions[id], { choice: 'approve', variant: name })
  }, `${id} is approved with ${name} in the answers file`)
})

Then('the page confirms the request for more variations', async function () {
  await this.browserPage.locator('.vs-toast.on', { hasText: 'Asked for more variations' }).waitFor()
})

Then('the answers file asks for more variations of {string}', async function (id) {
  await eventually(() => {
    assert.deepEqual(this.answers().decisions[id], { choice: 'vary' })
  }, `${id} asks for more variations in the answers file`)
})

Then('the steer box on {string} is closed, quoting {string}', async function (id, note) {
  const section = this.browserPage.locator(`#${id}`)
  await eventually(async () => {
    // The box folds to a zero-height row rather than hiding, so read the fold.
    const height = await section.locator('.steer').evaluate(steer => steer.getBoundingClientRect().height)
    assert.equal(height, 0, 'the box is still open')
    const status = await section.locator('.status').textContent()
    assert.ok(status.includes(note), `the status says "${status}"`)
  }, `the steer box on ${id} closes`)
})

Then('the section {string} shows the revision, quoting {string}', async function (id, note) {
  const section = this.browserPage.locator(`#${id}`)
  await eventually(async () => {
    assert.equal((await section.locator('h2').textContent()).trim(), 'Drag the bigger handle')
    const status = await section.locator('.status').textContent()
    assert.ok(status.includes('Revised') && status.includes(note), `the status says "${status}"`)
    assert.equal(await section.locator('[aria-pressed="true"]').count(), 0, 'it waits for a fresh answer')
  }, `${id} shows the revision`)
})

Then('the report shows the section {string}', async function (id) {
  await this.browserPage.locator(`#${id}.current`).waitFor({ timeout: 5000 })
  assert.equal(await this.browserPage.locator('.finding.current').count(), 1, 'one section shows at a time')
})

Then('the pictures of {string} wait behind a blur', async function (id) {
  const section = this.browserPage.locator(`#${id}`)
  await eventually(async () => {
    const filter = await section.locator('.wipe, .cmp').first().evaluate(pictures => getComputedStyle(pictures).filter)
    assert.match(filter, /blur/, `the pictures are drawn with "${filter}"`)
  }, `${id} waits behind a blur`)
})

Then('the page announces the revision of {string}', async function (id) {
  await this.browserPage.locator('#arrival.on').waitFor({ timeout: 5000 })
  await this.browserPage.locator(`#${id}.ready [data-show-revision]`).waitFor()
})

Then('steering {string} again starts with an empty note', async function (id) {
  await openSection(this.browserPage, id)
  await this.browserPage.locator(`#${id} .steer-link`).click()
  assert.equal(await this.browserPage.locator(`#${id} .steer textarea`).inputValue(), '')
})

Then('the page shows the review filed with {int} approved', async function (count) {
  const filed = this.browserPage.locator('.filed')
  await filed.waitFor({ timeout: 5000 })
  assert.match(await filed.locator('.filed-stamp').innerText(), new RegExp(`${count}`))
  assert.equal(await filed.locator('.filed-stack img').count(), count)
})

Given('a Polish report with no sections is served', async function () {
  const template = fs.readFileSync(REPORT_TEMPLATE, 'utf8')
  await this.startReportServer(template.replace(/<!-- Sections sit under a category heading[\s\S]*?(?=<section class="closing")/, ''))
})

When('the reviewer opens the empty report', async function () {
  this.pageErrors = []
  this.browserPage.on('pageerror', error => this.pageErrors.push(String(error)))
  await this.browserPage.goto(this.reportUrl)
})

Then('the report says there is nothing to change', async function () {
  await this.browserPage.locator('.empty-note h2').waitFor()
  assert.equal((await this.browserPage.locator('.empty-note h2').innerText()).trim(), 'Nothing to change at this level')
  await this.browserPage.locator('.closing.current').waitFor()
  assert.deepEqual(this.pageErrors, [], 'the page runs without errors')
})

When('the agent recommends the level {string}', async function (level) {
  const doc = this.answers()
  doc.recommend = { level, reason: { en: 'The screen looks right.', zh: '页面看起来没问题。' } }
  fs.writeFileSync(this.answersFile + '.tmp', JSON.stringify(doc))
  fs.renameSync(this.answersFile + '.tmp', this.answersFile)
})

Then('the panel {string} shows as recommended', async function (level) {
  await this.browserPage.locator(`.panel[data-level="${level}"].rec .p-rec`).waitFor({ timeout: 5000 })
  assert.equal(await this.browserPage.locator('.panel.rec').count(), 1, 'one panel is recommended')
  assert.match(await this.browserPage.locator('#recLine').innerText(), /页面看起来没问题/)
})

When('the reviewer chooses Report only', async function () {
  // The options sit folded under the panels until Change opens them.
  assert.equal(await this.browserPage.locator('#options').isVisible(), false, 'the options start folded')
  await this.browserPage.locator('#optToggle').click()
  await this.browserPage.locator('[data-delivery="report"]').click()
})

When('the reviewer sets the effort to {string} and turns on Proofread', async function (effort) {
  const page = this.browserPage
  assert.equal(await page.locator('[data-effort="medium"]').getAttribute('aria-pressed'), 'true', 'Medium is the default')
  assert.equal(await page.locator('[data-lab][aria-checked="true"]').count(), 0, 'experiments start off')
  await page.locator(`[data-effort="${effort}"]`).click()
  await page.locator('[data-lab="proofread"]').click()
})

Then('Done folds the options into one line under the panels, on a phone as well', async function () {
  const page = this.browserPage
  await page.locator('#optToggle').click()
  assert.equal(await page.locator('#options').isVisible(), false, 'Done folds the options')
  assert.match(await page.locator('#optSummary').innerText(), /只出报告 · 投入程度：高 · 已开实验功能/)
  const size = page.viewportSize()
  await page.setViewportSize({ width: 375, height: 667 })
  const panel = await page.locator('.panel').first().boundingBox()
  assert.ok(panel.y < 300, `the first level starts at ${Math.round(panel.y)}, on the first screen`)
  const panels = await page.locator('#panels').boundingBox(), summary = await page.locator('.opt-summary').boundingBox()
  assert.ok(summary.y > panels.y + panels.height, 'the options line sits under the panels')
  await page.setViewportSize(size)
})

Then('the effort hint names the model for {string}', async function (effort) {
  const profile = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../plugins/vstack/host-profiles/${this.hostId}.json`), 'utf8'))
  const hint = await this.browserPage.locator('#effortHint').innerText()
  const run = profile.effortLevels?.[effort]
  if (run) assert.ok(hint.includes(run.modelName), `"${hint}" names ${run.modelName}`)
  else assert.match(hint, /沿用当前模型/, `"${hint}" says the model stays as it is`)
})

Then('the answers file runs at {string} effort, with only Proofread on', async function (effort) {
  await eventually(() => {
    const doc = this.answers()
    assert.equal(doc.effort, effort)
    assert.equal(doc.proofread, true)
    assert.equal(doc.trimCopy, false)
  }, 'the answers file holds the effort and the experiments')
})

Then('the answers file asks for a report', async function () {
  await eventually(() => { assert.equal(this.answers().delivery, 'report') }, 'the answers file holds the delivery')
})

Given('a design report handoff is served', async function () {
  const template = fs.readFileSync(REPORT_TEMPLATE, 'utf8')
  await this.startReportServer(template.replace('<html', '<html data-handoff').replaceAll(' data-decide>', ' data-decide data-decision="approve">'))
})

When('the reviewer opens the handoff report', async function () {
  await this.browserPage.goto(this.reportUrl)
  await this.browserPage.locator('#f-example').waitFor()
})

Then('every section shows at once, with nothing to answer', async function () {
  const sections = this.browserPage.locator('.finding')
  const total = await sections.count()
  assert.ok(total > 1, 'the template has several sections')
  for (let index = 0; index < total; index++) assert.ok(await sections.nth(index).isVisible(), `section ${index + 1} shows`)
  assert.equal(await this.browserPage.locator('.decide:visible').count(), 0, 'no decision buttons')
  assert.equal(await this.browserPage.locator('.slidenav').isVisible(), false, 'no slide controls')
})

// A Host with pull delivery, such as Codex, waits in bounded calls and resumes from the WAIT line.
function runWait (world, command) {
  const result = spawnSync('/bin/sh', ['-c', command], { cwd: world.temp, encoding: 'utf8', timeout: 30000 })
  world.waitOutput = result.stdout
  world.waitCommand = (result.stdout.match(/^WAIT +(.+)$/m) || [])[1]
}

When('the agent waits {int} second for an answer', function (seconds) {
  // Under the tool's former name, which an agent on an older copy of the skill still passes.
  runWait(this, `node "${BRIDGE_CLI}" watch --json "${this.answersFile}" --tool design-review --next --timeout ${seconds} --seq 0`)
})

Then('the wait ends IDLE with a command that resumes from seq 0', function () {
  assert.match(this.waitOutput, /^IDLE +target-round-1 · seq 0$/m)
  assert.match(this.waitCommand, / watch --json .+ --tool polish --next --timeout 1 --seq 0$/, 'the resume command uses the current name')
})

When('the agent runs the wait command it was given', async function () {
  await eventually(() => { assert.equal(this.answers().decisions['f-example']?.choice, 'approve') }, 'the approval is sent')
  runWait(this, this.waitCommand)
})

Then('the wait reports the send, with a command that resumes from it', function () {
  const sent = this.waitOutput.match(/^SENT +target-round-1 · seq (\d+) · read /m)
  assert.ok(sent, `a SENT line in:\n${this.waitOutput}`)
  assert.ok(Number(sent[1]) > 0, 'the seq moved on')
  assert.match(this.waitCommand, new RegExp(` --seq ${sent[1]}$`))
})

// Off disk or in an Artifact there is no bridge; Send copies a brief. The clipboard is captured
// in the page, so the run never touches the machine's real clipboard.
Given('a Polish report is opened off disk', async function () {
  await this.browserPage.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text) => { window.__copied = text; return Promise.resolve() } } })
  })
  await this.browserPage.goto('file://' + REPORT_TEMPLATE)
  await this.browserPage.locator('#f-example .decide').waitFor()
})

Then('the copied brief carries the context, the reason and the spec of {string}', async function (id) {
  const brief = await this.browserPage.evaluate(() => window.__copied)
  assert.match(brief, /^# Polish decisions: Target/)
  assert.match(brief, /## Context\nTarget: the address, screen or repo path reviewed\./)
  assert.match(brief, /## How to act on this/)
  const section = brief.split('\n### ').find(part => part.includes(`(${id})`))
  assert.ok(section, `${id} is in the brief`)
  assert.match(section, /Decision: Approved/)
  assert.match(section, /Why: The grey hints in the form are too pale to read/)
  assert.match(section, /Today: One short detail\nProposed: One short detail/)
  assert.match(section, /Spec:\nWhere: the sign-up form/)
  assert.doesNotMatch(section, /六个词|一句简短/, 'English only')
})

Then('the copied brief steers {string} with {string} and leaves {string} unanswered', async function (steered, note, open) {
  const brief = await this.browserPage.evaluate(() => window.__copied)
  assert.match(brief, new RegExp(`## Steer \\(1\\)\\n\\n### [^\\n]+\\(${steered}\\)\\nDecision: Steer\\nOwner's note: ${note}`))
  assert.match(brief, new RegExp(`## Unanswered \\(1\\)\\n\\n### [^\\n]+\\(${open}\\)\\nDecision: Unanswered`))
  assert.match(brief, /Proposed \(Lanes\): One short detail\nProposed \(Band\): One short detail/, 'an unanswered section lists every variation')
})

Then('the report server has closed', async function () {
  assert.ok(await this.waitForServerExit(), 'Approve & finish closes the server')
})
