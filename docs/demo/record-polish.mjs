/*
 * Records the README's Polish demo and writes docs/assets/polish-demo.gif.
 *
 * Nothing here is staged. The JSON bridge serves the shipped start page, and
 * headless Chrome drives it the way an owner would: watch the audit, answer
 * the report, finish. The agent's turn is played by writing the answers file,
 * as the skill does: tick the tasks, then write the report over the start
 * page. It opens on the level chooser, previews each level in turn, and picks
 * Showcase. The report reviews the same todo page
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
// Each step is a function run in the page with its argument, so no page code is built from strings.
const step = (fn, arg) => ({ fn, arg })
const shoot = async (clipOf, change) => {
  await shooter.goto('file://' + path.join(HERE, 'pages/v1.html'))
  if (change) await shooter.evaluate(change.fn, change.arg)
  const clip = await shooter.evaluate(clipOf.fn, clipOf.arg)
  const png = await shooter.screenshot({ clip })
  return 'data:image/png;base64,' + png.toString('base64')
}
const around = (selectors, pad = 12) => step(([selectors, pad]) => {
  const boxes = selectors.map(s => document.querySelector(s).getBoundingClientRect())
  const top = Math.min(...boxes.map(b => b.top)) - pad, bottom = Math.max(...boxes.map(b => b.bottom)) + pad
  return { x: 0, y: Math.max(0, top), width: 390, height: bottom - Math.max(0, top) }
}, [selectors, pad])
const css = rules => step(rules => {
  const style = document.createElement('style')
  style.textContent = rules
  document.head.append(style)
}, rules)
// Done tasks turn green in both variants, so the move reads at a glance.
const moveDone = into => step(into => {
  const list = document.querySelector('.card ul'), done = [...list.querySelectorAll('li.done')]
  const style = document.createElement('style')
  style.textContent = 'li.done .tick{background-color:#16a34a;border-color:#16a34a} li.done .task{color:#15803d}'
  document.head.append(style)
  const label = `<div style="padding:9px 17px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803d">✓ Done · ${done.length}</div>`
  if (into === 'section') {
    const card = document.createElement('div')
    card.className = 'card'
    card.style.cssText = 'margin-top:14px;background:#ecfdf3;border-color:#bbf7d0'
    card.innerHTML = label + '<ul></ul>'
    done.forEach(li => { li.style.borderColor = '#d1fadf'; card.querySelector('ul').append(li) })
    document.querySelector('.card').after(card)
  } else {
    // No label here: it would make the picture taller than the slide shows.
    done.forEach(li => { li.style.background = '#ecfdf3'; list.append(li) })
  }
}, into)
// A solid card rather than a gradient: an undithered GIF bands a gradient.
const progressHeader = step(() => {
  const total = document.querySelectorAll('li').length, done = document.querySelectorAll('li.done').length
  const h1 = document.querySelector('h1'), sub = document.querySelector('.sub')
  const head = document.createElement('div')
  head.className = 'head'
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;' +
    'border-radius:18px;background:#4b5bf7;color:#fff;box-shadow:0 12px 28px rgba(75,91,247,.35)'
  h1.before(head)
  const words = document.createElement('div')
  words.append(sub, h1)
  sub.textContent = 'Monday, 3 August'
  sub.style.cssText = 'margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.75)'
  h1.style.cssText = 'font-size:36px;color:#fff'
  const circumference = 2 * Math.PI * 24
  const ring = document.createElement('div')
  ring.style.cssText = 'position:relative;width:64px;height:64px;flex:none'
  ring.innerHTML = `<svg viewBox="0 0 60 60" width="64" height="64" style="transform:rotate(-90deg)">
    <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="7"/>
    <circle cx="30" cy="30" r="24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${circumference * done / total} ${circumference}"/></svg>
    <b style="position:absolute;inset:0;display:grid;place-items:center;font-size:15px">${done}/${total}</b>`
  head.append(words, ring)
}, null)
const celebrate = step(() => {
  const card = document.querySelector('.card')
  card.style.position = 'relative'
  card.style.boxShadow = '0 10px 30px rgba(75,91,247,.12)'
  const row = document.querySelectorAll('li')[2]
  row.classList.add('done')
  // A flat tint: an undithered GIF bands a gradient.
  row.style.cssText = 'background:#eef0fe'
  row.querySelector('.task').style.color = '#4b5bf7'
  const tick = row.querySelector('.tick')
  tick.style.cssText = 'transform:scale(1.25);background-color:#4b5bf7;box-shadow:0 0 0 7px rgba(75,91,247,.22)'
  // The burst sits on the card, so it can spill into the rows around the ticked one.
  const origin = { x: row.offsetLeft + 28, y: row.offsetTop + row.offsetHeight / 2 }
  const colours = ['#4b5bf7', '#7c5cff', '#ff9a5c', '#ffd36b', '#22c55e', '#ef5da8']
  const bits = [[-12, -30], [14, -38], [44, -30], [78, -40], [112, -26], [150, -36], [190, -22], [228, -32],
    [-16, 28], [18, 36], [52, 26], [90, 38], [130, 28], [170, 36], [210, 24], [250, 34], [262, -10], [236, 6]]
  bits.forEach(([dx, dy], index) => {
    const bit = document.createElement('i')
    const size = 6 + (index % 3) * 2
    bit.style.cssText = `position:absolute;left:${origin.x + dx}px;top:${origin.y + dy}px;width:${size}px;height:${index % 2 ? size : size * 2}px;` +
      `border-radius:${index % 2 ? '50%' : '2px'};background:${colours[index % colours.length]};transform:rotate(${index * 41}deg)`
    card.append(bit)
  })
  const toast = document.createElement('div')
  toast.textContent = '✓  Nice! 3 of 6 done'
  toast.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:9px 18px;border-radius:999px;' +
    'background:#4b5bf7;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 22px rgba(75,91,247,.35);white-space:pre'
  card.append(toast)
}, null)
const bothCards = step(() => {
  const cards = [...document.querySelectorAll('.card')].map(c => c.getBoundingClientRect())
  const top = cards[0].top - 12, bottom = cards.at(-1).bottom + 12
  return { x: 0, y: top, width: 390, height: bottom - top }
})
const pictures = {
  headToday: await shoot(around(['h1', '.compose'])),
  headProposed: await shoot(around(['.head', '.compose']), progressHeader),
  orderToday: await shoot(around(['.card'])),
  orderSection: await shoot(bothCards, moveDone('section')),
  orderBottom: await shoot(around(['.card']), moveDone('bottom')),
  tickToday: await shoot(around(['.card'])),
  tickProposed: await shoot(around(['.card']), celebrate),
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
  '<h2 class="area-title cat">What stands out</h2>\n' +
  finding('f-head', 'The header hides your progress',
    'How much of the day is done sits in small grey text. A bold header card with a progress ring shows it at a glance.',
    [figure('Today', 'Progress in small text', pictures.headToday), figure('Proposed', 'A header card with a progress ring', pictures.headProposed)]) +
  '<h2 class="area-title cat">Clarity</h2>\n' +
  finding('f-order', 'Done tasks sit among open ones',
    'Ticked tasks are mixed in with the ones still to do, so the list reads as one block. Moving them apart puts the open tasks first.',
    [figure('Today', 'Done and open mixed', pictures.orderToday),
      figure('Proposed', 'A Done section', pictures.orderSection, 'Section'),
      figure('Proposed', 'Done tasks at the bottom', pictures.orderBottom, 'Bottom')]) +
  '<h2 class="area-title cat">Delight</h2>\n' +
  finding('f-tick', 'Ticking a task feels flat',
    'Finishing a task only fills a circle. A short burst of confetti and a progress note make each tick feel earned.',
    [figure('Today', 'A plain tick', pictures.tickToday), figure('Proposed', 'A tick that celebrates', pictures.tickProposed)])

let report = fs.readFileSync(path.join(SKILL, 'report-template.html'), 'utf8')
report = report.replace(/<title>.*?<\/title>/, '<title>Todo app · Polish round 1</title>')
report = report.replace('<h1>Target</h1>', '<h1>Todo app</h1>')
report = report.replace('Polish · Round 1 · Clean', 'Polish · Round 1 · Showcase').replace('打磨 · 第 1 轮 · 简洁', '打磨 · 第 1 轮 · 惊艳')
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
// The recommendation is already in, so the pick of Showcase follows it.
const recommend = { level: 'showcase', reason: { en: 'An app people open every day. A little delight keeps them coming back.', zh: '每天都会打开的应用，一点惊喜能留住用户。' } }
fs.writeFileSync(DOC, JSON.stringify({ stage: 'choose', delivery: 'build', canBuild: true, recommend, decisions: {}, overall: '', revised: {} }))
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
await page.locator('#choose:not([hidden])').waitFor()
const panel = async level => page.locator(`[data-level="${level}"]`).boundingBox()
const over = (box, x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y })
// The pointer starts on Clean, so the first frame is already a preview.
const mouse = hand(page, over(await panel('clean'), 0.5, 0.45))
await mouse.moveTo(mouse.at)
await page.locator('.linkdot.on, #linkDot.on').first().waitFor({ timeout: 20000 }).catch(() => {})

const { frames, stop } = capture(page, path.join(WORK, 'frames'))
const reading = []
const read_ = () => { const now = Date.now(); reading.push({ from: now, to: now + 2500, capMs: READ_CAP_MS }) }
await sleep(450)

/* ── the level, previewed and picked ── */
await mouse.glide(over(await panel('refined'), 0.5, 0.45), 340)
await sleep(280)
// Showcase tilts toward the pointer, so the pointer drifts across it rather than parking.
const showcase = await panel('showcase')
await mouse.glide(over(showcase, 0.3, 0.35), 340)
await mouse.glide(over(showcase, 0.65, 0.6), 520)
await sleep(120)
await mouse.click()
await until(() => read().level === 'showcase', 'the page to save the level')
write({ stage: 'audit', tasks })
await sleep(150)

/* ── the audit, ticking off ── */
for (const task of tasks) {
  await sleep(320)
  task.done = true
  write({ tasks })
}
await sleep(900)

/* ── the report, written over the start page ── */
fs.writeFileSync(HTML, report)
write({ stage: 'report' })
await page.locator('#f-head.current .decide').waitFor({ timeout: 15000 })
read_()
await sleep(1200)

await mouse.glideTo('#f-head .decide [data-d="approve"]', 420)
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
await page.locator('#f-tick.current').waitFor()
read_()
await sleep(1000)
await mouse.glideTo('#f-tick .decide [data-d="approve"]', 380)
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
