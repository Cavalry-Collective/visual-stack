/*
 * Records the README's Polish demo and writes docs/assets/polish-demo.gif.
 *
 * Nothing here is staged. The JSON bridge serves the shipped start page, and
 * headless Chrome drives it the way an owner would: watch the audit, answer
 * the report, finish. The agent's turn is played by writing the answers file,
 * as the skill does: tick the tasks, then write the report over the start
 * page. It opens with the level already picked, on the audit's progress. The report reviews the same todo page
 * the review demo uses, with pictures taken of it here, today and with each
 * proposed change applied.
 *
 *   cd e2e && npm ci          # once — playwright is borrowed from here
 *   node docs/demo/record-polish.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemble, capture, drawPointer, hand, loadChromium, sleep } from './recording.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const SKILL = path.join(REPO, 'plugins/vstack/skills/polish/assets')
const BRIDGE = path.join(REPO, 'plugins/vstack/lib/json-bridge.mjs')
const OUT = process.argv[2] || path.join(REPO, 'docs/assets/polish-demo.gif')
// The report slide the Polish page shows, taken from this same run so the two always match.
const chromium = loadChromium(REPO)

/* ── how it is shot ── */

const VIEWPORT = { width: 920, height: 760 }
const HOLD_CAP_MS = 500      // the longest any unchanging state is shown
const READ_CAP_MS = 900     // a slide's pictures, the first time they appear
const FINAL_HOLD_MS = 1400   // the filed review, before the loop starts again
const PORT = 24556

const WORK = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-polish-demo-')))
const DIR = path.join(WORK, '.vstack', 'local', 'polish')
fs.mkdirSync(DIR, { recursive: true })
const DOC = path.join(DIR, 'todo-round-1.json')
const HTML = path.join(DIR, 'todo-round-1.html')

const read = () => JSON.parse(fs.readFileSync(DOC, 'utf8'))
/* The agent's write: whole document, atomically, keeping what the page saved. */
const write = change => {
  const next = { ...read(), ...change }
  fs.writeFileSync(DOC + '.tmp', JSON.stringify(next, null, 2))
  fs.renameSync(DOC + '.tmp', DOC)
}
const until = async (test, what, ms = 15000) => {
  for (const start = Date.now(); Date.now() - start < ms; await sleep(100)) if (test()) return
  throw new Error(`timed out waiting for ${what}`)
}

/* ── the pictures: the todo page today, and with each change ── */

const browser = await chromium.launch()
const shooter = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 })
const shoot = async (clipOf, change = '') => {
  await shooter.goto('file://' + path.join(HERE, 'pages/v1.html'))
  if (change) await shooter.evaluate(change)
  const clip = await shooter.evaluate(clipOf)
  const png = await shooter.screenshot({ clip })
  return 'data:image/png;base64,' + png.toString('base64')
}
const around = (selectors, pad = 12) => `(() => {
  const boxes = ${JSON.stringify(selectors)}.map(s => document.querySelector(s).getBoundingClientRect())
  const top = Math.min(...boxes.map(b => b.top)) - ${pad}, bottom = Math.max(...boxes.map(b => b.bottom)) + ${pad}
  return { x: 0, y: Math.max(0, top), width: 390, height: bottom - Math.max(0, top) }
})()`
const css = rules => `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(rules)}; document.head.append(s) })()`
const moveDone = into => `(() => {
  const list = document.querySelector('.card ul'), done = [...list.querySelectorAll('li.done')]
  ${into === 'section'
    ? `const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '14px'
       card.innerHTML = '<div style="padding:10px 17px 0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8b8f9a">Done</div><ul></ul>'
       done.forEach(li => card.querySelector('ul').append(li))
       document.querySelector('.card').after(card)`
    : `done.forEach(li => { li.style.opacity = '.55'; list.append(li) })`}
})()`

const pictures = {
  hintToday: await shoot(around(['h1', '.compose'])),
  hintProposed: await shoot(around(['h1', '.compose']), css('.field{color:#4a4e57}')),
  orderToday: await shoot(around(['.card'])),
  orderSection: await shoot(`(() => { const cards = [...document.querySelectorAll('.card')].map(c => c.getBoundingClientRect()); const top = cards[0].top - 12, bottom = cards.at(-1).bottom + 12; return { x: 0, y: top, width: 390, height: bottom - top } })()`, moveDone('section')),
  orderBottom: await shoot(around(['.card']), moveDone('bottom')),
  footToday: await shoot(`(() => { const li = [...document.querySelectorAll('li')].at(-2).getBoundingClientRect(), foot = document.querySelector('.foot').getBoundingClientRect(); return { x: 0, y: li.top - 8, width: 390, height: foot.bottom + 14 - (li.top - 8) } })()`),
  footProposed: await shoot(`(() => { const li = [...document.querySelectorAll('li')].at(-2).getBoundingClientRect(), foot = document.querySelector('.foot').getBoundingClientRect(); return { x: 0, y: li.top - 8, width: 390, height: foot.bottom + 14 - (li.top - 8) } })()`, css('.foot{margin-top:14px}')),
}
await shooter.close()

/* ── the report the agent writes ── */

const figure = (tag, detail, src, variant) =>
  `<figure class="side${tag === 'Proposed' ? ' prop' : ''}"${variant ? ` data-variant="${variant}" data-variant-zh="${variant}"` : ''}>` +
  `<figcaption><b>${tag}</b> ${detail}</figcaption><div class="shot"><img alt="${tag}" src="${src}"></div></figure>`
const finding = (id, title, why, figures) =>
  `<article class="finding" id="${id}" data-decide><div class="fh"><h2>${title}</h2></div>` +
  `<p class="why">${why}</p><div class="cmp">${figures.join('')}</div></article>\n`
const sections =
  '<h2 class="area-title cat">Readability</h2>\n' +
  finding('f-hint', 'The task hint is hard to read',
    'The grey words in the empty task box are pale enough to miss. A darker grey reads easily and still looks like a hint.',
    [figure('Today', 'Pale hint', pictures.hintToday), figure('Proposed', 'Darker hint', pictures.hintProposed)]) +
  '<h2 class="area-title cat">What stands out</h2>\n' +
  finding('f-order', 'Done tasks sit among open ones',
    'Ticked tasks are mixed in with the ones still to do, so the list reads as one block. Moving them apart puts the open tasks first.',
    [figure('Today', 'Done and open mixed', pictures.orderToday),
      figure('Proposed', 'A Done section', pictures.orderSection, 'Section'),
      figure('Proposed', 'Done tasks at the bottom', pictures.orderBottom, 'Bottom')]) +
  '<h2 class="area-title cat">Layout</h2>\n' +
  finding('f-foot', 'The footer floats away from the list',
    'A wide gap separates the count and Clear from the list they belong to. Bringing them closer keeps them with the tasks.',
    [figure('Today', 'A wide gap', pictures.footToday), figure('Proposed', 'Close to the list', pictures.footProposed)])

let report = fs.readFileSync(path.join(SKILL, 'report-template.html'), 'utf8')
report = report.replace(/<title>.*?<\/title>/, '<title>Todo app · Polish round 1</title>')
report = report.replace('<h1>Target</h1>', '<h1>Todo app</h1>')
report = report.replace(/(<script type="text\/plain" id="handoff-context">)[\s\S]*?(<\/script>)/,
  '$1\nTarget: docs/demo/pages/v1.html, the todo page the review demo uses.\nDelivery: build in this repo.\n$2')
const from = report.indexOf('<!-- Sections sit under a category heading')
const to = report.indexOf('<section class="closing"')
report = report.slice(0, from) + sections + report.slice(to)

/* ── the review, opened the way the skill opens it ── */

const tasks = [
  ['read', 'Read the page and its styles'],
  ['walk', 'Walk the page at phone and desktop sizes'],
  ['check', 'Check type, spacing and contrast'],
  ['draw', 'Draw the proposed fixes'],
].map(([id, en]) => ({ id, text: { en, zh: en }, done: false }))
fs.copyFileSync(path.join(SKILL, 'review-start.html'), HTML)
fs.writeFileSync(DOC, JSON.stringify({ stage: 'audit', level: 'clean', lang: 'en', delivery: 'build', canBuild: true, tasks, decisions: {}, overall: '', revised: {} }))
const server = spawn(process.execPath, [BRIDGE, 'serve', '--json', DOC, '--template', HTML,
  '--tool', 'polish', '--port', String(PORT), '--host', 'claude', '--no-open', '--idle-timeout', '0'],
{ cwd: WORK, stdio: ['ignore', 'pipe', 'pipe'] })
const children = [server]
process.on('exit', () => { for (const child of children) { try { child.kill() } catch {} } })
let log = ''
server.stdout.on('data', chunk => { log += chunk })
server.stderr.on('data', chunk => { log += chunk })
await until(() => /open (http\S+)/.test(log), 'the server to start')
const url = log.match(/open (http\S+)/)[1]
const seq = (log.match(/seq .*\((\d+)\)/) || [])[1] || '0'
// The session listening, so the bar reads Linked for the whole recording.
children.push(spawn(process.execPath, [BRIDGE, 'watch', '--json', DOC, '--stream', '--tool', 'polish', '--seq', seq],
  { cwd: WORK, stdio: 'ignore' }))

const page = await browser.newPage({ viewport: VIEWPORT })
await drawPointer(page)
await page.goto(url)
await page.locator('#progress:not([hidden])').waitFor()
const mouse = hand(page, { x: 760, y: 640 })
await mouse.moveTo(mouse.at)
await page.locator('.linkdot.on, #linkDot.on').first().waitFor({ timeout: 20000 }).catch(() => {})

const { frames, stop } = capture(page, path.join(WORK, 'frames'))
const reading = []
const read_ = () => { const now = Date.now(); reading.push({ from: now, to: now + 2500, capMs: READ_CAP_MS }) }
await sleep(300)

/* ── the audit, ticking off ── */
for (const task of tasks) {
  await sleep(450)
  task.done = true
  write({ tasks })
}
await sleep(900)

/* ── the report, written over the start page ── */
fs.writeFileSync(HTML, report)
write({ stage: 'report' })
await page.locator('#f-hint.current .decide').waitFor({ timeout: 15000 })
read_()
await sleep(1200)

await mouse.glideTo('#f-hint .decide [data-d="approve"]', 420)
await mouse.click()
await page.locator('#f-order.current').waitFor()
read_()
await sleep(900)
await mouse.glideTo('#f-order .side.prop:not([hidden]) .variants button[data-v="Bottom"]', 380)
await mouse.click()
read_()
await sleep(900)
await mouse.glideTo('#f-order .decide [data-d="approve"]', 380)
await mouse.click()
await page.locator('#f-foot.current').waitFor()
read_()
await sleep(1000)
await mouse.glideTo('#f-foot .decide [data-d="approve"]', 380)
await mouse.click()
await page.locator('.closing.current').waitFor()
await sleep(600)
await mouse.glideTo('#closingFinish', 420)
await mouse.click()
await sleep(450)
await mouse.click()
await page.locator('.filed').waitFor({ timeout: 10000 })
await sleep(1200)

await stop()
await browser.close()
for (const child of children) child.kill()
console.log(`captured ${frames.length} frames over ${((frames.at(-1).at - frames[0].at) / 1000).toFixed(1)}s`)

assemble(frames, OUT, WORK, { holdCapMs: HOLD_CAP_MS, finalHoldMs: FINAL_HOLD_MS, holds: reading })
fs.rmSync(WORK, { recursive: true, force: true })
