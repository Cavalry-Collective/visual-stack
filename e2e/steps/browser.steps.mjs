import { Given, Then, When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import * as agent from '../support/mock-agent.mjs'
import { PAGES } from '../support/world.mjs'

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
   an attempt that observes without repeating the scroll can never recover. */

When('the reviewer scrolls the framed page to the bottom', async function () {
  const framed = await framedWindow(this)
  await eventually(async () => {
    const y = await framed.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
      return window.scrollY
    })
    assert.ok(y > 0, 'the page did not scroll')
  }, 'the page under review scrolls in its own window')
})

When('the reviewer scrolls the canvas to the bottom', async function () {
  const port = this.browserPage.locator('#viewportBox')
  await eventually(async () => {
    const top = await port.evaluate(element => {
      element.scrollTop = element.scrollHeight
      return element.scrollTop
    })
    assert.ok(top > 0, 'the canvas did not scroll')
  }, 'the canvas scrolls')
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
