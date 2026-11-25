// Temporary capture harness for the Polish round on site-map.html. Not committed.
// Usage: node polish-cap.mjs <job.json>
// A job lists shots: {html, doc, out, width, height, scheme, flags, plan, status, steps, clip, frames}
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const browser = await chromium.launch()

for (const shot of job.shots) {
  const html = fs.readFileSync(shot.html, 'utf8')
  const doc = JSON.parse(fs.readFileSync(shot.doc, 'utf8'))
  if (shot.plan) doc.plan = shot.plan
  if (shot.set) Object.assign(doc, shot.set)
  if (shot.status) {
    ;(function walk (list) { list.forEach(s => { if (shot.status[s.id]) Object.assign(s, shot.status[s.id]); if (s.children) walk(s.children) }) })(doc.sitemap.screens.concat(doc.sitemap.workflows || []))
  }
  const context = await browser.newContext({ viewport: { width: shot.width || 1440, height: shot.height || 900 }, colorScheme: shot.scheme || 'light', deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', e => console.log('pageerror', shot.out, e.message))
  const bridge = `<script>window.__VSTACK_BRIDGE__={token:'t',name:'site-map',doc:'/doc',save:'/save',events:'/events',history:'/history',watching:true};window.__VSTACK_HOST__={id:'claude',name:'Claude'}</script>`
  const flags = shot.flags ? `<script>document.documentElement.dataset.p=${JSON.stringify(shot.flags)}</script>` : ''
  await page.route('http://proto.test/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html.replace('<head>', '<head>' + bridge + flags) })
    if (url.pathname === '/doc') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    if (url.pathname === '/save') return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' })
    return route.abort()
  })
  await page.goto('http://proto.test/')
  await page.locator(shot.ready || '#tree .node').first().waitFor({ timeout: 5000 })
  for (const step of shot.steps || []) {
    if (step.hover) await page.locator(step.hover).first().hover()
    if (step.click) await page.locator(step.click).first().click()
    if (step.move) await page.mouse.move(step.move[0], step.move[1])
    if (step.wait) await page.waitForTimeout(step.wait)
    if (step.eval) await page.evaluate(step.eval)
  }
  const clipOf = async () => {
    if (!shot.clip) return undefined
    if (Array.isArray(shot.clip)) return { x: shot.clip[0], y: shot.clip[1], width: shot.clip[2], height: shot.clip[3] }
    const box = await page.locator(shot.clip).first().boundingBox()
    const pad = shot.pad ?? 8
    return { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
  }
  if (shot.frames) {
    // Freeze every animation at each time and capture one frame per time.
    for (const [index, ms] of shot.frames.entries()) {
      await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t }), ms)
      await page.waitForTimeout(60)
      await page.screenshot({ path: shot.out.replace('.png', `-f${index + 1}.png`), clip: await clipOf(), fullPage: shot.full || false })
    }
  } else {
    if (shot.settle) await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish() } catch { a.pause(); a.currentTime = 600 } }))
    await page.screenshot({ path: shot.out, clip: await clipOf(), fullPage: shot.full || false })
  }
  if (shot.measure) console.log(shot.out, JSON.stringify(await page.evaluate(shot.measure)))
  await context.close()
}
await browser.close()
console.log('captured', job.shots.length)
