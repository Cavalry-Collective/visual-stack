/*
 * What every README recording shares: playwright and ffmpeg, a drawn pointer,
 * a hand-like mouse, frame capture and GIF assembly. CLAUDE.md says why each
 * setting is what it is; the scripts that use this decide only what is shown.
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

/* Playwright is the e2e suite's dependency, not the plugin's — the plugin ships
   with none, and a recording tool is not a reason to give it one. */
export function loadChromium (repo) {
  let chromium
  try {
    ({ chromium } = createRequire(path.join(repo, 'e2e/'))('playwright'))
  } catch {
    console.error('playwright is missing — run `cd e2e && npm ci` first')
    process.exit(1)
  }
  if (spawnSync('ffmpeg', ['-version']).status !== 0) {
    console.error('ffmpeg is missing — `brew install ffmpeg`')
    process.exit(1)
  }
  return chromium
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/* A screenshot has no pointer in it, so the recording draws its own and lets it
   follow the real mouse. Reading the events rather than being told where the
   pointer is keeps the drawing and the input from ever disagreeing. It is added
   before every navigation, so a page that reloads keeps its pointer. */
export async function drawPointer (page) {
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
      /* Where the pointer was, so a page that reloads under it does not lose it. */
      let last = null
      try { last = JSON.parse(sessionStorage.getItem('vs-demo-at')) } catch {}
      if (last) cursor.style.transform = `translate(${last.x}px,${last.y}px)`
      addEventListener('mousemove', event => {
        try { sessionStorage.setItem('vs-demo-at', JSON.stringify({ x: event.clientX, y: event.clientY })) } catch {}
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
}

/** A mouse that moves the way a hand does: eased, and over enough frames to be seen moving. */
export function hand (page, start) {
  let at = start
  const glide = async (to, ms = 340) => {
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
  return {
    moveTo: async to => { at = to; await page.mouse.move(to.x, to.y) },
    glide,
    glideTo: async (selector, ms) => {
      const box = await page.locator(selector).boundingBox()
      if (!box) throw new Error(`${selector} is not on screen`)
      await glide({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, ms)
    },
    click: async () => { await page.mouse.down(); await sleep(60); await page.mouse.up() },
    get at () { return at },
  }
}

/** Screenshot as fast as the page allows until `stop` is called. */
export function capture (page, dir) {
  fs.mkdirSync(dir, { recursive: true })
  const frames = []
  let capturing = true
  const done = (async () => {
    for (let i = 0; capturing; i++) {
      /* PNG, not JPEG: a lossy re-encode perturbs every block in the frame, so
         two frames that differ only by the cursor differ everywhere, and the GIF
         encoder can no longer skip the parts that did not change. It is worth
         about half the file size. */
      const file = path.join(dir, `f${String(i).padStart(5, '0')}.png`)
      /* A screenshot started as the page reloads can hang until it times out,
         and the recording goes on without frames meanwhile. A short limit lets
         the next one, a moment later, take over. */
      try { await page.screenshot({ path: file, type: 'png', timeout: 1000 }) } catch { await sleep(30); continue }
      frames.push({ file, at: Date.now() })
    }
  })()
  return { frames, stop: async () => { capturing = false; await done } }
}

/**
 * Write the GIF. One entry per state on screen: the first frame that showed
 * it, and how long it stayed. Capture runs well above the frame rate, so a
 * still page is dozens of copies, and a wait the recording sat through must not
 * become a wait the reader sits through.
 */
export function assemble (frames, out, work, { holdCapMs, finalHoldMs, fps = 25, colors = 256, holds = [] }) {
  const states = []
  for (const [index, frame] of frames.entries()) {
    const hash = crypto.createHash('md5').update(fs.readFileSync(frame.file)).digest('hex')
    const next = frames[index + 1]
    const held = (next ? next.at : frame.at + 40) - frame.at
    const last = states.at(-1)
    if (last?.hash === hash) last.ms += held
    else states.push({ hash, file: frame.file, ms: held, at: frame.at })
  }
  /* A moment the reader needs time to take in, such as a picture to compare,
     may stay up longer than the cap. */
  const capFor = state => {
    const hold = holds.find(h => state.at >= h.from && state.at <= h.to)
    return hold ? hold.capMs : holdCapMs
  }
  for (const state of states) state.ms = Math.min(state.ms, capFor(state))
  states.at(-1).ms = finalHoldMs

  const listFile = path.join(work, 'frames.txt')
  const list = states
    .map(state => `file '${state.file}'\nduration ${(state.ms / 1000).toFixed(3)}`)
    .join('\n')
  // The concat demuxer ignores the last entry's duration unless the file repeats.
  fs.writeFileSync(listFile, `ffconcat version 1.0\n${list}\nfile '${states.at(-1).file}'\n`)

  const ffmpeg = (...args) => {
    const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8' })
    if (run.status !== 0) throw new Error(run.stderr || 'ffmpeg failed')
  }
  const palette = path.join(work, 'palette.png')
  const concat = ['-f', 'concat', '-safe', '0', '-i', listFile]
  ffmpeg(...concat, '-vf', `fps=${fps},palettegen=max_colors=${colors}:stats_mode=full`, '-y', palette)
  // No dithering: the page is flat colour, and dither noise defeats the encoder.
  ffmpeg(...concat, '-i', palette, '-lavfi',
    `fps=${fps}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', '-y', out)

  const seconds = states.reduce((total, state) => total + state.ms, 0) / 1000
  console.log(`${states.length} states, ${seconds.toFixed(1)}s, ` +
    `${(fs.statSync(out).size / 1024).toFixed(0)} KB -> ${out}`)
}
