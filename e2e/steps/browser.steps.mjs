import { Then, When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

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

Then('the comment {string} is a draft on the review', function (note) {
  const comment = this.byNote(note)
  assert.equal(comment.sentAt, null, 'still being written, not sent')
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
