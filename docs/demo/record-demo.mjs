/*
 * Records the README demo and writes docs/assets/wireframe-demo.gif.
 *
 * Nothing here is staged: a real review server serves the page in
 * `pages/v1.html`, headless Chrome drives the workspace the way a reviewer
 * would, and the agent's turn is played by the review CLI — take delivery of
 * the round, swap in `pages/v2.html`, publish it back. The workspace is the
 * shipped one, so a change to it shows up in the next recording.
 *
 * Run it from a checkout:
 *
 *   cd e2e && npm ci          # once — playwright is borrowed from here
 *   node docs/demo/record-demo.mjs
 *
 * The dimensions and the pacing are the ones the README needs; CLAUDE.md says
 * why each of them is what it is.
 */
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const SERVER = path.join(REPO, 'plugins/vstack/skills/review/assets/review-server.mjs')
const OUT = process.argv[2] || path.join(REPO, 'docs/assets/wireframe-demo.gif')

/* Playwright is the e2e suite's dependency, not the plugin's — the plugin ships
   with none, and a recording tool is not a reason to give it one. */
let chromium
try {
  ({ chromium } = createRequire(path.join(REPO, 'e2e/'))('playwright'))
} catch {
  console.error('playwright is missing — run `cd e2e && npm ci` first')
  process.exit(1)
}
if (spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('ffmpeg is missing — `brew install ffmpeg`')
  process.exit(1)
}

/* ── what the demo says ── */

const POINT_NOTE = 'Add a due-date picker here, next to the Add button.'
const AREA_NOTE = 'Completed tasks should move to a Done section at the bottom.'
const STRIKE_NOTE = 'Shorten this to just Clear.'
const V2_LABEL = 'Due-date picker and Done section'
const V2_SUMMARY = 'Added the due-date button, grouped the completed tasks, and shortened the Clear label.'

/* ── how it is shot ── */

const VIEWPORT = { width: 920, height: 760 }
const TYPE_MS = 15           // fast enough to read, quick enough not to wait on
const HOLD_CAP_MS = 400      // the longest any unchanging state is shown
const FINAL_HOLD_MS = 550    // long enough to read the result, short enough to loop
const FPS = 25
const COLORS = 256
const PORT = 24555
const ORIGIN = `http://127.0.0.1:${PORT}`

/* Resolved, because on macOS the temp dir sits under the /var symlink and a
   store found by one path is not recognised as the store claimed by the other. */
const WORK = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-demo-')))
const FRAMES = path.join(WORK, 'frames')
const PAGE = path.join(WORK, 'page.html')
fs.mkdirSync(FRAMES)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const cli = (...argv) => {
  const run = spawnSync(process.execPath, [SERVER, ...argv], { cwd: WORK, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`${argv[0]} failed:\n${run.stdout}${run.stderr}`)
  return run.stdout
}

fs.copyFileSync(path.join(HERE, 'pages/v1.html'), PAGE)
cli('publish', '--file', PAGE, '--label', 'First draft')

/* A server left behind by a failed run still answers on this port, out of a
   store that run has already deleted. Recording against it is unexplainable. */
try {
  await fetch(ORIGIN + '/api/project')
  throw new Error(`something is already serving ${ORIGIN} — kill it and run again`)
} catch (error) {
  if (!/ECONNREFUSED|fetch failed/.test(String(error))) throw error
}

const server = spawn(process.execPath, [
  SERVER, 'serve', '--file', PAGE, '--port', String(PORT),
  '--host', 'claude', '--no-open', '--idle-timeout', '0',
], { cwd: WORK, stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = ''
server.stdout.on('data', chunk => { serverLog += chunk })
server.stderr.on('data', chunk => { serverLog += chunk })

/* A run that throws must not leave the port held, or the next one records
   against a server whose store is gone. */
const children = [server]
process.on('exit', () => { for (const child of children) { try { child.kill() } catch {} } })

for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(ORIGIN + '/api/project')).ok) break } catch {}
  if (attempt > 100) throw new Error(`server did not start:\n${serverLog}`)
  await sleep(100)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEWPORT })

/* A screenshot has no pointer in it, so the recording draws its own and lets it
   follow the real mouse. Reading the events rather than being told where the
   pointer is keeps the drawing and the input from ever disagreeing. */
await page.addInitScript(() => {
  const install = () => {
    const cursor = document.createElement('div')
    cursor.id = 'vs-demo-cursor'
    cursor.innerHTML = `<style>
      #vs-demo-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
        transform:translate(-200px,-200px)}
      #vs-demo-cursor .ptr{display:block;transform-origin:0 0;transition:transform .08s ease}
      #vs-demo-cursor.down .ptr{transform:scale(.86)}
      #vs-demo-cursor .ring{position:absolute;left:0;top:0;width:30px;height:30px;
        margin:-15px 0 0 -15px;border-radius:50%;border:2.5px solid rgba(75,91,247,.85);
        opacity:0;transform:scale(.25)}
      #vs-demo-cursor.tap .ring{animation:vs-demo-tap .5s ease-out}
      @keyframes vs-demo-tap{from{opacity:.95;transform:scale(.25)}to{opacity:0;transform:scale(1.6)}}
    </style>
    <svg class="ptr" width="22" height="24" viewBox="0 0 22 24">
      <path d="M0 0 L0 17.2 L4.4 13.2 L7.3 19.8 L10.5 18.4 L7.6 11.9 L13.6 11.7 Z"
        fill="#14161c" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
    <span class="ring"></span>`
    document.body.appendChild(cursor)
    addEventListener('mousemove', event => {
      cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`
    }, true)
    addEventListener('mousedown', () => {
      cursor.classList.add('down')
      cursor.classList.remove('tap')
      void cursor.offsetWidth      // restart the ripple on a second click in the same place
      cursor.classList.add('tap')
    }, true)
    addEventListener('mouseup', () => cursor.classList.remove('down'), true)
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install)
  else install()
})

await page.goto(ORIGIN + '/')
await page.locator('#frame').waitFor()
await page.frameLocator('#frame').locator('h1').waitFor()

/* The workspace refits the zoom on every version load. The recording is read at
   100%, so the refit is taken out for the session and the zoom pinned once. */
await page.evaluate(() => { window.fitZoom = () => {} })
await page.locator('#sizeSwitch button[data-size=phone]').click()
await page.evaluate(() => window.setZoom(1))
await sleep(400)

/* The agent session, listening — the streaming form, which is what a real
   session runs. The one-shot form has to exit to deliver a round, and the top
   bar goes Unlinked in the gap before anything is watching again; this one
   stays up for the whole recording. It goes live once its handshake is
   answered, so the answer is read off its own output. */
const watcher = spawn(process.execPath, [SERVER, 'watch', '--stream', '--file', PAGE],
  { cwd: WORK, stdio: ['ignore', 'pipe', 'pipe'] })
children.push(watcher)
let heard = ''
let acked = false
const delivered = new Promise(resolve => {
  const read = chunk => {
    heard += chunk
    const token = !acked && heard.match(/--token (\S+)/)
    if (token) { acked = true; cli('ack', '--file', PAGE, '--token', token[1]) }
    if (/^REVIEW/m.test(heard)) resolve()
  }
  watcher.stdout.on('data', read)
  watcher.stderr.on('data', read)
})
// Presence is polled every few seconds, which is what this wait is for.
await page.locator('#linkDot.on').waitFor({ timeout: 20000 })

/** Where an element of the page under review sits on screen. The canvas is
    CSS-scaled, so the mouse is aimed at a measured box, never at the element. */
async function framedBox (selector) {
  const box = await page.frameLocator('#frame').locator(selector).boundingBox()
  if (!box) throw new Error(`${selector} is not on screen`)
  return box
}
const middleOf = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

/** Where a run of words inside the page under review sits on screen. Striking
    words rather than a whole element is a drag between two points, and those
    points are in the middle of a text node — so they are measured in the text
    itself rather than off any element's box.

    The page's own coordinates are not the screen's, so the offset between them
    is measured from an element whose box is known both ways rather than assumed
    from where the frame sits. Assuming it puts the drag in the comments panel,
    where it silently strikes nothing. */
async function wordsBox (selector, words) {
  const frame = await (await page.locator('#frame').elementHandle()).contentFrame()
  /* Both boxes in one call, so the offset between them cannot be spoilt by the
     canvas moving between two reads — closing a composer re-lays it out. */
  const [inner, holder] = await frame.evaluate(([where, what]) => {
    const node = document.querySelector(where).firstChild
    const from = node.data.indexOf(what)
    if (from < 0) throw new Error(`"${what}" is not in ${where}`)
    const range = document.createRange()
    range.setStart(node, from)
    range.setEnd(node, from + what.length)
    const box = ({ x, y, width, height }) => ({ x, y, w: width, h: height })
    return [box(range.getBoundingClientRect()),
      box(document.querySelector(where).getBoundingClientRect())]
  }, [selector, words])
  // The element holding the words, placed on screen by the same machinery that
  // aims every other click in this recording.
  const onScreen = await framedBox(selector)
  return {
    x: onScreen.x + (inner.x - holder.x),
    y: onScreen.y + (inner.y - holder.y),
    w: inner.w,
    h: inner.h,
  }
}

let at = { x: 470, y: 470 }
await page.mouse.move(at.x, at.y)

/** Move the way a hand does: eased, and over enough frames to be seen moving. */
async function glide (to, ms = 340) {
  const from = at
  const steps = Math.max(6, Math.round(ms / 16))
  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
    await page.mouse.move(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased)
    await sleep(16)
  }
  at = to
}
async function glideTo (selector, ms) {
  await glide(middleOf(await page.locator(selector).boundingBox()), ms)
}
async function click () {
  await page.mouse.down()
  await sleep(60)
  await page.mouse.up()
}
async function write (note) {
  const editor = page.locator('#composer textarea.cnote')
  await editor.waitFor()
  await editor.pressSequentially(note, { delay: TYPE_MS })
  await editor.press('Enter')
  await sleep(150)
}

/* ── frames ── */
const frames = []
let capturing = true
const capture = (async () => {
  for (let i = 0; capturing; i++) {
    /* PNG, not JPEG: a lossy re-encode perturbs every block in the frame, so
       two frames that differ only by the cursor differ everywhere, and the GIF
       encoder can no longer skip the parts that did not change. It is worth
       about half the file size. */
    const file = path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`)
    try { await page.screenshot({ path: file, type: 'png' }) } catch { return }
    frames.push({ file, at: Date.now() })
  }
})()

await sleep(150)

/* ── a point comment on the compose row ── */
const field = await framedBox('.field')
await glide({ x: field.x + field.width * 0.62, y: field.y + field.height / 2 }, 380)
await click()
await write(POINT_NOTE)

/* ── an area comment over the whole list ── */
const card = await framedBox('.card')
await glide({ x: card.x - 4, y: card.y - 6 }, 340)
await page.mouse.down()
await glide({ x: card.x + card.width + 4, y: card.y + card.height + 6 }, 460)
await page.mouse.up()
await write(AREA_NOTE)

/* ── striking words out: the drag says which words go, and a note on top of it
      says what to put in their place ── */
/* The tool by its shortcut, not by a trip to the toolbar — that is a long move
   away from the page for something a reviewer does with one key. The composer
   has to be shut and unfocused first: a key pressed while typing is text, and a
   composer left open also swallows the first press on the canvas, closing
   itself instead of starting the gesture. */
await page.evaluate(() => { window.closeComposer(); document.activeElement?.blur() })
await sleep(250)           // closing it re-lays the canvas out; measure after that
await page.keyboard.press('d')
await sleep(150)
if (await page.locator('#toolbar [data-tool=delete]').getAttribute('aria-pressed') !== 'true') {
  throw new Error('pressing d did not reach the workspace — the strike tool is not selected')
}
/* Left to right, the way the words read. The footer sits well below the card,
   so it is clear of the area mark and of the note that mark hangs beneath
   itself — the press lands on canvas rather than on a mark, which would select
   that comment instead of starting a gesture.

   Both ends sit inside the words. A point just past the last character is in no
   text node at all, so no caret resolves there and the strike takes nothing. */
const words = await wordsBox('.clear', 'all completed tasks')
const wordsY = words.y + words.h / 2
await glide({ x: words.x + 2, y: wordsY }, 340)
await sleep(120)
await page.mouse.down()
await glide({ x: words.x + words.w - 2, y: wordsY }, 440)
await page.mouse.up()
/* A strike that captured nothing opens no composer, and the Escape below would
   leave Annotate rather than close one — which is how a demo ends up sent with
   the mark missing and nothing saying so. */
await page.locator('#composer.on').waitFor({ timeout: 5000 }).catch(async () => {
  console.error('strike diagnostics:', JSON.stringify({
    words,
    composer: await page.locator('#composer').getAttribute('class'),
    toast: await page.locator('.vs-toast').textContent().catch(() => null),
    tool: await page.locator('#toolbar [data-tool=delete]').getAttribute('aria-pressed'),
    mode: await page.locator('#modeSwitch [data-mode=annotate]').getAttribute('aria-pressed'),
    comments: (await (await fetch(ORIGIN + '/api/project')).json()).comments.map(c => c.kind),
  }))
  throw new Error('the strike captured nothing')
})
await sleep(120)
await write(STRIKE_NOTE)

/* ── sending the round ── */
/* Three marks were made, so three must be on the review before it is sent — a
   gesture that quietly captured nothing would otherwise ship as a demo of two.
   Saving is a request in flight, so this waits for it rather than sampling. */
let marks = []
for (let attempt = 0; attempt < 40 && marks.length < 3; attempt++) {
  marks = (await (await fetch(ORIGIN + '/api/project')).json()).comments
  if (marks.length < 3) await sleep(100)
}
if (marks.length !== 3) {
  throw new Error(`three marks were made, ${marks.length} reached the review: ` +
    marks.map(mark => mark.kind).join(', '))
}
await glideTo('#btnSend', 380)
await click()
await delivered

/* ── the agent's turn ── */
const { comments } = await (await fetch(ORIGIN + '/api/project')).json()
const ids = comments.map(comment => comment.id).join(',')
fs.copyFileSync(path.join(HERE, 'pages/v2.html'), PAGE)
cli('publish', '--file', PAGE, '--close', ids, '--label', V2_LABEL, '--summary', V2_SUMMARY)

await page.locator('#workBanner.on').waitFor()
await glideTo('#btnRefresh', 340)
await click()
await page.frameLocator('#frame').locator('.group').waitFor()
/* The toast covers the version it is announcing, and sitting through its life
   and its fade is most of a second at the end of a GIF that loops. Take it off
   rather than wait it out. */
await page.evaluate(() => document.querySelector('.vs-toast')?.remove())
await sleep(200)

capturing = false
await capture
await browser.close()
for (const child of children) child.kill()

const shot = (frames.at(-1).at - frames[0].at) / 1000
console.log(`captured ${frames.length} frames over ${shot.toFixed(1)}s`)

/* ── assembly ── */

/* One entry per state on screen: the first frame that showed it, and how long
   it stayed. Capture runs well above the frame rate, so a still page is dozens
   of copies, and a wait the reviewer sat through must not become a wait the
   reader sits through. */
const states = []
for (const [index, frame] of frames.entries()) {
  const hash = crypto.createHash('md5').update(fs.readFileSync(frame.file)).digest('hex')
  const next = frames[index + 1]
  const held = (next ? next.at : frame.at + 40) - frame.at
  const last = states.at(-1)
  if (last?.hash === hash) last.ms += held
  else states.push({ hash, file: frame.file, ms: held })
}
for (const state of states) state.ms = Math.min(state.ms, HOLD_CAP_MS)
states.at(-1).ms = FINAL_HOLD_MS

const listFile = path.join(WORK, 'frames.txt')
const list = states
  .map(state => `file '${state.file}'\nduration ${(state.ms / 1000).toFixed(3)}`)
  .join('\n')
// The concat demuxer ignores the last entry's duration unless the file repeats.
fs.writeFileSync(listFile, `ffconcat version 1.0\n${list}\nfile '${states.at(-1).file}'\n`)

const ffmpeg = (...args) => {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args],
    { encoding: 'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || 'ffmpeg failed')
}
const palette = path.join(WORK, 'palette.png')
const concat = ['-f', 'concat', '-safe', '0', '-i', listFile]
ffmpeg(...concat, '-vf', `fps=${FPS},palettegen=max_colors=${COLORS}:stats_mode=full`,
  '-y', palette)
// No dithering: the page is flat colour, and dither noise defeats the encoder.
ffmpeg(...concat, '-i', palette, '-lavfi',
  `fps=${FPS}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', '-y', OUT)

const seconds = states.reduce((total, state) => total + state.ms, 0) / 1000
console.log(`${states.length} states, ${seconds.toFixed(1)}s, ` +
  `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${OUT}`)

fs.rmSync(WORK, { recursive: true, force: true })
