#!/usr/bin/env node
/**
 * review-server.mjs — the local half of the wireframe review loop.
 *
 * Two things can go under review, and the loop around them is the same:
 *
 *   a file  — a wireframe, an exported screen, any self-contained HTML page.
 *             Served inside the workspace, with a version frozen on each publish.
 *   an app  — something already running on localhost. The server reverse-proxies
 *             it, so the reviewer drives the real UI inside the workspace and
 *             comments land on real elements, on the route they were made on.
 *
 * Either way the workspace shares an origin with what it is annotating — which
 * is the whole trick, because a comment is attached to an element, not to a
 * coordinate, and that needs to reach into the frame's document.
 *
 * Node >= 18, standard library only.
 *
 *   node review-server.mjs serve   --file <page.html> [--port 7788] [--idle-timeout 90] [--no-open]
 *   node review-server.mjs serve   --app <url> [--name <slug>] [--start /path] [--port 7788]
 *   node review-server.mjs watch   --file <page.html>   (blocks; hands over the open comments)
 *   node review-server.mjs publish --file <page.html> [--close c1,c3] [--label "…"] [--summary "…"]
 *   node review-server.mjs reply   --file <page.html> --comment <id> --text "…"
 *                                  [--option "…" --option "…" [--recommend <n>]]
 *   node review-server.mjs ack     --file <page.html> --token <token>
 *   node review-server.mjs share   --file <page.html> --url <artifact-url>
 *   node review-server.mjs status  --file <page.html>
 *
 * Every command takes `--app <url>` or `--name <slug>` in place of `--file` when
 * the review is of a running app.
 *
 * One list of comments, each open or closed, and the agent is the only one who
 * closes. `watch` hands over every open comment and records that it went;
 * whatever the agent does not close comes back on the next one. Nothing can
 * refuse a close: an agent that took delivery can always finish.
 *
 * State lives in a sibling directory, out of the way of the page:
 *   <dir>/.vstack/local/review/<name>/   (live: <cwd>/.vstack/local/review/<name>/)
 *     state.json            { name, version, file? | app?, start? }
 *     comments.json         every comment for this review — the whole truth
 *     brief.md              the open comments, rewritten on every delivery
 *     versions/v<n>.html    frozen copy of each published version
 *                           (live: the DOM as it stood when a review was sent)
 *     versions/v<n>.meta.json  label and date — a snapshot to look at, nothing more
 *     reviews/v<n>/         only ever read: where a store filled by an older
 *                           version keeps its comments
 *     handshake             a stream watcher waiting to be told its events land
 *     approved              sentinel written on sign-off — the review is over
 *     share                 sentinel — they want a shareable public link
 *     url                   the live URL — present only while the server runs
 *     watching              heartbeat — an agent session is waiting on this review
 *
 * A serve also leaves a pointer to that store under the directory it was run
 * from — `<cwd>/.vstack/local/review/.serving/<key>` — so `watch --all`, run
 * from the same place, finds a review whose page lives somewhere else entirely.
 *
 * Serving opens the workspace in the machine's default browser as soon as it is
 * up — `--no-open`, or VSTACK_NO_OPEN=1, for a run that should not.
 *
 * The server closes itself when the browser tab does: the workspace holds an
 * SSE connection, and once the last one goes away and none returns within the
 * grace period the server removes `url` and exits. That exit re-invokes the
 * agent and ends the waiter, so nothing is left listening.
 *
 * Host selection (contracts/host.md): --host <id> or VSTACK_HOST. Injects
 * window.__VSTACK_HOST__ so the workspace never hardcodes a product name.
 * Protocol details: contracts/review-loop.md.
 */

import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { checkForUpdate, currentVersion, dismissUpdate, withUpdate, withVersion } from '../../../lib/update-check.mjs'
import { resolveHostId, loadHost, withHost, AGENT_ROLE, REVIEWER_ROLE } from '../../../lib/host.mjs'
import { workDir, subjectDir, toolNames, LOCAL, TOOL } from '../../../lib/workdir.mjs'
import { writeAtomic, watchingRecently, startHeartbeat, startPresence, openInBrowser } from '../../../lib/live-link.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/* ────────────────────────────── args ────────────────────────────── */

function parseArgs (argv) {
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv.shift() : 'serve'
  const out = { _: cmd }
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else { out[key] = next; i++ }
  }
  return out
}
const args = parseArgs(process.argv.slice(2))

/** Every value given for a flag that may be repeated, in the order typed —
    `--option A --option B`. parseArgs keeps one value per flag, which is right
    for every other flag there is. */
function repeatedArg (flag) {
  const argv = process.argv.slice(2), out = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== `--${flag}`) continue
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) { out.push(next); i++ }
  }
  return out
}

/* The agent session this process acts for — `--session <id>`, supplied by the
   Host adapter. The engine never knows how a host names its sessions; it only
   records the identity it was given, so that a delivery binds to the session
   whose watcher took it and `unanswered --session` can answer for one session
   without implicating another standing in the same directory. */
const SESSION = args.session && args.session !== true ? String(args.session) : null

/** Host profile for UI injection (serve). Other commands ignore it. */
let HOST_PROFILE = null
try { HOST_PROFILE = loadHost(resolveHostId(args)) } catch (e) {
  if (args._ === 'serve') { console.error(e.message); process.exit(2) }
}

/* ── what is under review: a file, or a running app ───────────────── */

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'

/** "localhost:5173" and ":5173" are what people actually type. */
function targetURL (raw) {
  let s = String(raw).trim()
  if (/^:\d+$/.test(s)) s = 'http://localhost' + s
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  let u
  try { u = new URL(s) } catch { console.error(`Not a URL: ${raw}`); process.exit(1) }
  if (!/^https?:$/.test(u.protocol)) { console.error(`Only http(s) targets: ${raw}`); process.exit(1) }
  return u
}

const APP = args.app ? targetURL(args.app) : null
/* A command run away from `serve` (publish, reply, status) only needs to find
   the store, and `--name` is enough for that. */
const LIVE = !!APP || (!args.file && !args.root && !!args.name && args.name !== true)

let FILE = null, DIR, NAME, STORE
if (LIVE) {
  NAME = slug(args.name && args.name !== true ? args.name : `${APP.hostname}-${APP.port || APP.protocol.replace(':', '')}`)
  DIR = process.cwd()
  // Live state has nothing to sit beside, so it sits in the project — which
  // means every command has to be run from the same place. `--store` is the way
  // out when it can't be.
  STORE = args.store && args.store !== true ? path.resolve(String(args.store)) : subjectDir(DIR, TOOL.review, NAME)
  if (APP && !/^(localhost|127\.0\.0\.1|\[::1\]|::1|0\.0\.0\.0)$/i.test(APP.hostname)) {
    console.error(`Note: ${APP.origin} is a public site, not a local dev server. Its own absolute links`)
    console.error('      are rewritten to stay inside the proxy, but bot protection, a login wall or a')
    console.error('      strict CSRF check can still refuse it. If the site misbehaves, say so.')
  }
} else if (['watch', 'ack', 'unanswered'].includes(args._) && (args.all === true || args.all === 'true')) {
  /* `watch --all` names no subject on purpose — it finds the live ones itself,
     so a session with several pages open arms one waiter instead of one each. */
  DIR = process.cwd(); NAME = 'all'; STORE = workDir(DIR, TOOL.review)
} else {
  if (!args.file && !args.root) {
    console.error('What is under review? Pass --file <page.html>, or --app <url> for a running app.')
    process.exit(1)
  }
  FILE = path.resolve(args.file || args.root || '')
  if (!fs.existsSync(FILE) || !fs.statSync(FILE).isFile()) {
    console.error(`Not a file: ${FILE}`)
    process.exit(1)
  }
  DIR = path.dirname(FILE)
  NAME = path.basename(FILE).replace(/\.html?$/i, '')
  STORE = subjectDir(DIR, TOOL.review, NAME)
}

/** Where the workspace lives when the app owns the root path space. */
const BASE = LIVE ? '/__review' : ''
/** How every other command names this same review. */
const SUBJECT = LIVE ? `--name "${NAME}"` : `--file "${FILE}"`

const P = {
  state: () => path.join(STORE, 'state.json'),
  versions: () => path.join(STORE, 'versions'),
  version: n => path.join(STORE, 'versions', `v${n}.html`),
  /* Every comment for this review, in one list. Older stores kept a copy of a
     comment in each version's directory; `review(n)` is only ever read now. */
  comments: () => path.join(STORE, 'comments.json'),
  review: n => path.join(STORE, 'reviews', `v${n}`),
  brief: () => path.join(STORE, 'brief.md'),
  lock: () => path.join(STORE, 'transition.lock'),
  handshake: () => path.join(STORE, 'handshake'),
  approved: () => path.join(STORE, 'approved'),
  share: () => path.join(STORE, 'share'),
  url: () => path.join(STORE, 'url'),
  /* Touched by `watch` while it runs, deleted when it stops — the heartbeat
     protocol in lib/live-link.mjs. */
  watching: () => path.join(STORE, 'watching'),
}
const someoneWatching = () => watchingRecently(P.watching())

const readJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const writeJSON = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  writeAtomic(f, JSON.stringify(v, null, 2) + '\n')
}

/* A watcher writes into stores it did not start, so the lock is named by the
   store it protects rather than by this process's own subject. */
let heldLock = null, heldLockFile = null
const lockWait = new Int32Array(new SharedArrayBuffer(4))
const lockFile = store => path.join(store, 'transition.lock')
function acquireStoreLock (store, timeout = 2500) {
  fs.mkdirSync(store, { recursive: true })
  const file = lockFile(store)
  const until = Date.now() + timeout
  while (true) {
    try {
      heldLock = fs.openSync(file, 'wx')
      heldLockFile = file
      fs.writeFileSync(heldLock, `${process.pid}\n`)
      return
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        // A killed process cannot clean up. A transition never legitimately
        // holds this lock for thirty seconds, so recover that orphan safely.
        if (Date.now() - fs.statSync(file).mtimeMs > 30000) {
          fs.rmSync(file, { force: true })
          continue
        }
      } catch {}
      if (Date.now() >= until) throw new Error('review state is busy; retry the command')
      Atomics.wait(lockWait, 0, 0, 25)
    }
  }
}
function releaseStoreLock () {
  if (heldLock === null) return
  try { fs.closeSync(heldLock) } catch {}
  heldLock = null
  try { fs.rmSync(heldLockFile, { force: true }) } catch {}
  heldLockFile = null
}
function withStoreLock (fn, store = STORE) {
  acquireStoreLock(store)
  try { return fn() } finally { releaseStoreLock() }
}
process.on('exit', releaseStoreLock)

/** The page names itself through its <title>; the filename is the fallback.
    A running app has no one title — it has a different one per route — so the
    name is what the reviewer called it, or the host it is on. */
function pageName () {
  if (LIVE) {
    if (args.name && args.name !== true) return String(args.name)
    return loadState().name || (APP ? APP.host : NAME)
  }
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(fs.readFileSync(FILE, 'utf8'))
  const t = m && m[1].trim()
  return t || NAME
}
/** The origin being proxied — from the flag, or from the store when a later
    command was run with just `--name`. */
const appOrigin = () => (APP ? APP.origin : loadState().app || null)
const loadState = () => readJSON(P.state(), { version: 0 })
const saveState = s => writeJSON(P.state(), s)

/* ──────────────────────── the comment list ───────────────────────
   One list per review, and the only place a comment's state lives. A comment
   is open or closed. Two timestamps say where it is between the reviewer and
   the agent: `sentAt` is the reviewer letting go of it, which also freezes its
   words; `deliveredAt` is the agent taking it, after which withdrawing it
   leaves the record behind. `deliveredTo` names the session that took it —
   whichever identity the last deliverer was started with — so what a session
   owes is a recorded fact, not an inference from standing in the same
   directory. Everything the workspace shows is derived from those. */

/**
 * What a review is, read from its own store rather than from this process's
 * flags. One watcher covers reviews it did not start, and it has to be able to
 * hand their comments over and name the commands that answer them.
 */
function subjectOf (store) {
  const state = readJSON(path.join(store, 'state.json'), {}) || {}
  const live = !!state.app
  const name = state.name || path.basename(store)
  return {
    store, state, live, name,
    file: state.file || null,
    origin: state.app || null,
    flags: live ? `--name "${name}"` : `--file "${state.file || ''}"`,
    comments: path.join(store, 'comments.json'),
    brief: path.join(store, 'brief.md'),
  }
}
const here = () => subjectOf(STORE)

const loadComments = (subject = here()) =>
  readJSON(subject.comments)?.comments || adoptOlderStore(subject.store)

function saveComments (comments, subject = here()) {
  writeJSON(subject.comments, {
    version: 1, updatedAt: new Date().toISOString(), comments,
  })
  return comments
}

/** Fields the protocol owns. A client may write everything else on a comment it
 *  still holds, and none of these ever. */
const OWNED = ['state', 'sentAt', 'deliveredAt', 'deliveredTo', 'dismissedAt']

const normaliseComment = c => ({
  ...c,
  state: c.state === 'closed' ? 'closed' : 'open',
  replies: c.replies || [],
  sentAt: c.sentAt || null,
  deliveredAt: c.deliveredAt || null,
  deliveredTo: c.deliveredTo || null,
})

/**
 * A store filled before the comment list existed keeps a copy of each comment
 * in every version directory it appeared in. Read the newest copy of each and
 * translate it: `addressed` and a reviewer's dismissal are both closed, and
 * anything already sent has been in the agent's hands.
 *
 * Those files are left exactly where they are. A user's review is not migrated
 * behind their back — the list is simply written alongside from now on.
 */
function adoptOlderStore (store = STORE) {
  let dirs = []
  try {
    dirs = fs.readdirSync(path.join(store, 'reviews'))
      .flatMap(file => { const m = /^v(\d+)$/.exec(file); return m ? [Number(m[1])] : [] })
      .sort((a, b) => a - b)
  } catch { return [] }
  const newest = new Map()
  for (const version of dirs) {
    const saved = readJSON(path.join(store, 'reviews', `v${version}`, 'annotations.json'))
    for (const old of saved?.annotations || []) newest.set(old.id, { old, version })
  }
  return [...newest.values()].map(({ old, version }) => {
    const { status, dismissed, reopenedAt, revert, held, fromVersion, ...rest } = old
    return normaliseComment({
      ...rest,
      seenAt: fromVersion || version,
      state: status === 'addressed' || dismissed ? 'closed' : 'open',
      sentAt: old.sentAt || null,
      deliveredAt: old.sentAt || null,
    })
  })
}

/** Open, and released by the reviewer — what a tick hands over. */
const deliverable = comments => comments.filter(c => c.state === 'open' && c.sentAt)

/** Has the reviewer said anything the agent has not been given yet? A comment
 *  it has never seen, or an answer written since it last took delivery. */
const unseen = comment => !comment.deliveredAt ||
  (comment.replies || []).some(reply => reply.by === REVIEWER_ROLE &&
    Date.parse(reply.at || '') > Date.parse(comment.deliveredAt))
const anythingWaiting = (subject = here()) =>
  deliverable(loadComments(subject)).some(unseen)

/* ───────────────────────────── the brief ─────────────────────────
   The open comments, written for the agent. It is rendered here rather than in
   the workspace because the workspace does not know what a delivery is: a tick
   hands over everything open, whenever each of them was written. */

const SCREENS = [
  { id: 'ultrawide', label: 'Ultrawide', width: 2560, height: 1440 },
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'tablet', label: 'Tablet', width: 834, height: 1112 },
  { id: 'phone', label: 'Phone', width: 390, height: 844 },
]

/** An element written as its own opening tag — what to search the source for. */
const elLine = anchor => '`<' + anchor.tag + (anchor.id ? ` id="${anchor.id}"` : '') +
  (anchor.cls ? ` class="${anchor.cls}"` : '') + (anchor.role ? ` role="${anchor.role}"` : '') + '>`'

/** Where a comment is, said the way a person would: the thing it is on first,
 *  the part of the page it lives in second, coordinates last. */
function whereLine (comment) {
  if (comment.kind === 'general') return 'the page as a whole — not attached to an element'
  const geo = comment.kind === 'area' && comment.rect
    ? `area ${Math.round(comment.rect.w)}×${Math.round(comment.rect.h)} at ${Math.round(comment.rect.x)},${Math.round(comment.rect.y)}`
    : `at ${Math.round(comment.point?.x || 0)},${Math.round(comment.point?.y || 0)}`
  const anchor = comment.anchor
  if (!anchor) return `${geo}${comment.anchorText ? ` — on “${comment.anchorText}”` : ''}`
  const words = anchor.text || anchor.label
  const region = !anchor.region ? ''
    : anchor.region.kind === 'region' ? (anchor.region.label ? ` inside “${anchor.region.label}”,` : '')
      : ` inside ${anchor.region.kind}${anchor.region.label ? ` “${anchor.region.label}”` : ''},`
  return `on ${elLine(anchor)}${words ? ` “${words}”` : ''},${region} ${geo}`
}

/** A move, said as a place rather than a distance: the page reflows and the
 *  pixels stop being true, but the element it was dropped on does not. */
function moveLine (comment) {
  const delta = comment.delta || { dx: 0, dy: 0 }
  const dragged = `dragged ${Math.abs(delta.dx)}px ${delta.dx >= 0 ? 'right' : 'left'} and ${Math.abs(delta.dy)}px ${delta.dy >= 0 ? 'down' : 'up'}`
  const target = comment.target
  if (!target?.anchor) return `somewhere else on the page — ${dragged}. Nothing was under the drop, so the direction is all they gave you.`
  const words = target.anchor.text || target.anchor.label
  const place = target.where === 'inside' ? 'into' : target.where === 'before' ? 'before' : 'after'
  return `${place} ${elLine(target.anchor)}${words ? ` “${words}”` : ''} (${dragged})`
}

const strikeLine = comment => comment.scope === 'text'
  ? `the text “${String(comment.text || '').slice(0, 160)}” — remove those words, leave the rest of the element`
  : 'this element and everything in it'

const coversLine = comment => comment.covers.map(c => `\`<${c.tag}>\` “${c.text}”`).join(' · ')

function renderBrief (subject, going, fresh) {
  const L = []
  L.push(`# ${subject.live ? 'Live UI review' : 'Wireframe review'} — ${subject.name} · v${subject.state.version || 1}`)
  L.push(`${going.length} open comment(s) — every one is a must` +
    (fresh.size ? ` · ${fresh.size} new since you last looked` : ''))
  L.push('')
  if (subject.live) {
    L.push(`These are comments on the app running at \`${subject.origin || subject.name}\` — change the source, ` +
      'not a mockup. Each comment says which **route** it was made on; the anchor names the ' +
      'element, which is what to search the codebase for.')
    L.push('')
    L.push('The reviewer is looking at the app right now. If it hot-reloads they will see your ' +
      'change as you make it, so land whole changes rather than half of one.')
  } else {
    L.push(`Apply these to \`${subject.file ? path.basename(subject.file) : subject.name}\`, then publish the next version.`)
  }
  if (going.some(comment => comment.kind === 'move' || comment.kind === 'strike')) {
    L.push('')
    L.push('Some of these were drawn on the page rather than written: **Move it** is an arrow ' +
      'from a thing to where it should go, and **Delete** is something struck out. They are ' +
      'instructions in their own right — a note on one adds to it, and no note means there was ' +
      'nothing to add.')
  }
  L.push('')

  const bySize = {}
  for (const comment of going) (bySize[comment.size || 'desktop'] ||= []).push(comment)
  for (const screen of SCREENS) {
    const list = bySize[screen.id]
    if (!list?.length) continue
    L.push(`## ${screen.label} — ${screen.width} × ${screen.height}`)
    L.push('')
    for (const comment of list) {
      L.push(`### ${comment.id}${fresh.has(comment.id) ? ' · NEW' : ''}`)
      if (!fresh.has(comment.id)) L.push('*You have had this one before and it is still open — carry on with it rather than starting again.*')
      if (subject.live && comment.route) L.push(`**Route** \`${comment.route}\``)
      L.push(`**Where** ${whereLine(comment)}`)
      if (comment.kind === 'move') L.push(`**Move it** ${moveLine(comment)}`)
      if (comment.kind === 'strike') L.push(`**Delete** ${strikeLine(comment)}`)
      if (comment.covers?.length) L.push(`**Covers** ${coversLine(comment)}`)
      if (comment.note) L.push(comment.note)
      for (const reply of comment.replies || []) {
        L.push('')
        L.push(`> **${reply.by === REVIEWER_ROLE ? 'They replied' : 'You asked'}:** ${reply.text}`)
        // The options you offered, so a question that comes back reads as the
        // question you actually asked rather than only its opening line.
        for (const option of reply.options || []) {
          L.push(`> - ${option.text}${option.recommended ? ' *(you recommended this)*' : ''}`)
        }
      }
      L.push('')
    }
  }
  L.push('---')
  L.push('Close what you have done. Anything you do not name stays open and comes back next time,')
  L.push('so ask about whatever is unclear instead of guessing:')
  L.push('```bash')
  L.push(`node review-server.mjs publish ${subject.flags} --close <ids> --label "<what changed>" \\`)
  L.push(`  --summary "<the rest of what you would tell them>"   # optional, shown in the workspace`)
  L.push(`node review-server.mjs reply ${subject.flags} --comment <id> --text "<your question>"`)
  L.push('```')
  return L.join('\n') + '\n'
}

/**
 * Hand every open comment to the agent, and record that it went.
 *
 * All of them, every time — not only the new ones. A comment the agent skipped
 * comes back on the next tick, so the only way to be rid of one is to close it,
 * and nothing can be forgotten by being missed. What is new since the last
 * delivery is marked as such, which is a hint for where to look rather than a
 * filter on what arrives.
 */
function deliver (subject = here()) {
  const comments = loadComments(subject)
  const going = deliverable(comments)
  const fresh = new Set(going.filter(comment => !comment.deliveredAt).map(comment => comment.id))
  const at = new Date().toISOString()
  /* The latest delivery owns the round: a comment handed over again binds to
     whoever took it this time, which is also how a review adopted after its
     session died changes hands. A watcher given no identity records none. */
  for (const comment of going) { comment.deliveredAt = at; comment.deliveredTo = SESSION }
  saveComments(comments, subject)
  fs.mkdirSync(subject.store, { recursive: true })
  writeAtomic(subject.brief, renderBrief(subject, going, fresh))
  return { going, fresh }
}

/* Presence is the watcher: it is the loop that takes delivery, so a live
   heartbeat is a session that will be handed the next comment written. */
const agentListening = () => someoneWatching()

const openComments = () => loadComments()
  .filter(comment => comment.state === 'open' && String(comment.note || '').trim())
  .map(comment => ({ id: comment.id, note: comment.note, sent: !!comment.sentAt }))

/* A published round is its meta file. The frozen html beside it is optional —
   a live round only has one once a review has been sent from it, and a round
   with no capture is still a round. */
function listVersions () {
  if (!fs.existsSync(P.versions())) return []
  const ns = new Set()
  for (const f of fs.readdirSync(P.versions())) {
    const m = /^v(\d+)\.(html|meta\.json)$/.exec(f)
    if (m) ns.add(Number(m[1]))
  }
  return [...ns].sort((a, b) => a - b).map(n => ({
    ...readJSON(path.join(P.versions(), `v${n}.meta.json`), { n, label: `Version ${n}` }),
    captured: fs.existsSync(P.version(n)),
  }))
}

/* ──────────────────────────── publish ───────────────────────────── */

/**
 * The agent's answer: close what is done, and snapshot the version it did it in.
 *
 * The two halves are independent. `--close` closes exactly the comments it
 * names and nothing else — anything left unnamed stays open and comes back on
 * the next tick, so there is no coverage to satisfy and nothing to account for.
 * `--label` freezes the page as the next version. Neither can be refused for
 * anything the reviewer has done in the meantime: an agent that took delivery
 * can always finish.
 *
 * --replace overwrites the current version instead of adding one, for a version
 * nobody has reviewed yet.
 */
function cmdPublish (quiet) {
  const ids = [...new Set(String(args.close ?? args.addressed ?? '').split(',').map(s => s.trim()).filter(Boolean))]
  const label = args.label && args.label !== true ? String(args.label) : null
  /* The label names the version in one line; the summary is what the agent
     would say in chat about the round it just finished. The workspace shows it
     where the news lands, so a reviewer who is not reading the terminal still
     gets the account of what changed. */
  const summary = args.summary && args.summary !== true ? String(args.summary).trim() : null
  /* A version is a frozen copy of the page under review, and a running app has
     no such thing: what a capture of one produces is a likeness with its scripts
     stripped and half its styling missing, which is worse than not offering it.
     So a live review has no versions — only comments. */
  const snapshot = !LIVE && (!!label || (!ids.length && args.close === undefined && args.addressed === undefined))

  const comments = loadComments()
  if (ids.length) {
    const byId = new Map(comments.map(comment => [comment.id, comment]))
    const errors = []
    for (const id of ids) {
      const comment = byId.get(id)
      if (!comment) errors.push(`${id} is not a comment on this review`)
      else if (!comment.sentAt) errors.push(`${id} has not been sent yet`)
    }
    // Closing is all or nothing, so a typo costs a retry rather than half a round.
    if (errors.length) {
      console.error('Cannot close:')
      for (const error of errors) console.error(`  - ${error}`)
      process.exit(2)
    }
    // Closing what is already closed is a no-op, so a retried command is safe.
    const at = new Date().toISOString()
    for (const id of ids) {
      const comment = byId.get(id)
      if (comment.state === 'closed') continue
      comment.state = 'closed'
      // What was just closed is what the reviewer wants to look at; what was
      // closed a while ago is a record. The panel reads that off this.
      comment.closedAt = at
    }
    saveComments(comments)
  }

  let n = loadState().version
  if (LIVE && !n) {
    // Live has one version and it is the app itself, so the number never moves.
    const state = loadState()
    state.version = n = 1
    state.name = pageName()
    saveState(state)
  }
  if (snapshot) {
    const replace = args.replace === true || args.replace === 'true'
    n = replace ? Math.max(1, n) : n + 1
    fs.mkdirSync(P.versions(), { recursive: true })
    if (!LIVE) fs.copyFileSync(FILE, P.version(n))
    const prev = readJSON(path.join(P.versions(), `v${n}.meta.json`), {}) || {}
    writeJSON(path.join(P.versions(), `v${n}.meta.json`), {
      n,
      label: label || prev.label || (n === 1 ? (LIVE ? 'The app as it stands' : 'Initial version') : `Version ${n}`),
      date: new Date().toISOString(),
    })
    const state = loadState()
    state.version = n
    state.name = pageName()
    saveState(state)
  }
  /* One summary at a time, and it belongs to the round that has just landed —
     a publish that carries none clears the last one rather than leaving the
     workspace showing an account of work that is now two rounds old. Written
     for a live review too, which has no version to hang it on. */
  if (ids.length || snapshot) {
    const state = loadState()
    state.summary = summary ? { text: summary, at: new Date().toISOString() } : null
    saveState(state)
  }

  if (!quiet) {
    console.log([
      snapshot ? `Published v${n}` : null,
      ids.length ? `closed ${ids.length} comment(s)` : null,
    ].filter(Boolean).join(' — ') || 'Nothing to do')
    /* Said here because here is where the agent believes it has finished. The
       tick will not raise these again on its own — it wakes for what the
       reviewer says, and they have said it already. */
    const left = loadComments().filter(comment => comment.state === 'open' && comment.deliveredAt)
    if (left.length) {
      console.log(`${left.length} comment(s) you were given are still open: ${left.map(c => c.id).join(', ')}`)
      console.log('Close them, or reply asking about them — leaving one silently leaves it on the reviewer.')
    }
  }
  touch()
}

/**
 * Start the review over. Everything a version of this tool wrote about it goes:
 * the comments, the brief, the snapshots, and the directories a store filled by
 * an older version keeps its comments in — which would otherwise be adopted
 * straight back on the next read. What the review *is* stays: the page or app
 * under it, and its name.
 *
 * It is a command as well as a button because the reason to want it is a tool
 * update that changed what a review keeps on disk, and that is exactly when the
 * workspace may not be the thing that can ask for it.
 */
function cmdReset (quiet) {
  saveComments([])
  fs.rmSync(P.brief(), { force: true })
  fs.rmSync(path.join(STORE, 'reviews'), { recursive: true, force: true })
  fs.rmSync(P.versions(), { recursive: true, force: true })
  fs.rmSync(P.approved(), { force: true })
  fs.rmSync(P.share(), { force: true })
  const state = loadState()
  saveState({
    name: state.name, version: 0,
    ...(state.file ? { file: state.file } : {}),
    ...(state.app ? { app: state.app, start: state.start } : {}),
  })
  // A file review with no version has nothing for the workspace to show, so the
  // page as it stands becomes v1 again. A live review has no versions at all.
  cmdPublish(true)
  console.log('\n⟲ Reset — the review starts again at v1')
  touch()
  if (!quiet) console.log('Every comment and version for this review is gone.')
}

/**
 * Answer a comment in its own thread. Use it when a comment is ambiguous —
 * asking beats guessing, and the reviewer sees the question on the mark itself.
 * The comment moves to `question` until they reply, which puts it back to open.
 */
function cmdReply () {
  const id = args.comment
  const text = args.text
  if (!id || !text) {
    console.error('Need --comment <id> --text "…"')
    process.exit(1)
  }
  /* A question the reviewer answers by picking rather than by typing. The
     options are offered on the comment, one of them can be marked as the one
     you would take, and the box to type something else is still there — a
     choice you did not think of is the whole reason the question was asked. */
  const options = repeatedArg('option')
  const recommend = args.recommend === undefined ? 0 : Number(args.recommend)
  if (options.length === 1) {
    console.error('A choice needs at least two --option values')
    process.exit(2)
  }
  if (options.length && (!Number.isInteger(recommend) || recommend < 0 || recommend > options.length)) {
    console.error(`--recommend must be between 1 and ${options.length}, or left out`)
    process.exit(2)
  }
  const comments = loadComments()
  const target = comments.find(comment => comment.id === id)
  if (!target) { console.error(`No comment ${id} found`); process.exit(1) }
  // Asking is not a state: the comment stays open, and stays in the next tick
  // until it is closed. Whether it is waiting on the reviewer is written in the
  // thread — the last word being the agent's — not in a second field that can
  // disagree with it.
  target.replies = (target.replies || []).concat({
    by: AGENT_ROLE, text, at: new Date().toISOString(),
    ...(options.length
      ? { options: options.map((option, i) => ({ text: option, recommended: i + 1 === recommend })) }
      : {}),
  })
  saveComments(comments)
  console.log(`Replied to ${id} — the reviewer will see it on the comment`
    + (options.length ? ` with ${options.length} options to pick from` : ''))
  touch()
}

/**
 * Hand the published Artifact's URL back to the workspace. It appears under the
 * ▾ beside Send, tagged with the version it was published from — so a link that
 * has gone stale says so instead of quietly misleading whoever you sent it to.
 */
function cmdShare () {
  const url = args.url
  if (!url || url === true) {
    console.error('Need --url <artifact-url>')
    process.exit(1)
  }
  const state = loadState()
  state.shareUrl = String(url)
  state.shareVersion = Number(args.version) || state.version
  saveState(state)
  fs.rmSync(P.share(), { force: true })
  console.log(`Shareable link recorded for v${state.shareVersion} — it is now in the workspace`)
  touch()
}

/**
 * Wait for the reviewer, and say so on the page while waiting.
 *
 * This replaces the shell `until [ -f pending ] …` loop the skill used to
 * describe, and adds the half that was missing: a heartbeat, so the workspace
 * can tell the difference between "the page can reach its server" and "someone
 * is actually going to read what I send". Exits the moment there is something
 * to do, printing what it was and which review it came from.
 *
 * One waiter covers as many reviews as you have open — a session with a
 * wireframe and a story map up needs one of these, not one each:
 *
 *   node review-server.mjs watch --file <page.html>
 *   node review-server.mjs watch --file a.html --file b.html
 *   node review-server.mjs watch --all           (every live review under cwd)
 */
const storeFor = f => {
  const abs = path.resolve(f)
  return subjectDir(path.dirname(abs), TOOL.review, path.basename(abs).replace(/\.html?$/i, ''))
}
const inStore = (store, name) => path.join(store, name)

/* Where a server records the store it is serving, for the benefit of a watcher
   that cannot walk to it.

   A review's store sits beside the page under review, and `watch --all` finds
   stores by walking the directory it was run from. A page written outside that
   directory — a temp directory is the usual one, since that is where an agent
   puts a file it just generated — takes its store with it, and the watcher
   walks right past a review that is running. It then heartbeats into nothing
   while the workspace says Unlinked, which is the one failure this protocol
   must not have.
   The directory both processes share is the one the session ran them from, so
   the server leaves a pointer there naming its real store. Keyed by the store
   path, so a second serve from the same place adds a pointer rather than
   overwriting one. */
const servingDir = from => path.join(workDir(from, TOOL.review), '.serving')
const servingFile = (from, store) =>
  path.join(servingDir(from), createHash('sha1').update(store).digest('hex').slice(0, 12))

/** Stores pointed at from `from`, minus any whose server is gone. */
function pointedStores (from) {
  const found = []
  for (const tool of toolNames(TOOL.review)) {
    const dir = path.join(workDir(from, tool), '.serving')
    let entries = []
    try { entries = fs.readdirSync(dir) } catch { continue }
    for (const name of entries) {
      const pointer = path.join(dir, name)
      let store = ''
      try { store = fs.readFileSync(pointer, 'utf8').trim() } catch { continue }
      // The pointer is written after `url` and removed with it, so a pointer
      // with no `url` behind it belongs to a server that was killed outright.
      if (store && fs.existsSync(path.join(store, 'url'))) found.push(store)
      else fs.rmSync(pointer, { force: true })
    }
  }
  return found
}

/** Every store with a server behind it — `url` exists only while one runs. */
function liveStores (from = process.cwd(), depth = 5) {
  const found = []
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'versions', 'reviews'])
  const walk = (dir, left) => {
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (!e.isDirectory() || skip.has(e.name)) continue
      const here = path.join(dir, e.name)
      // Reviews hang off `.vstack/local/review/`; the rest of `.vstack` belongs
      // to the pipeline and the other tools, so stop here rather than walking
      // their files. Both directories are read: one waiter has to find a review
      // opened before the rename as readily as one opened after it.
      if (e.name === '.vstack') {
        /* One subject is one review however many directories it appears in:
           `toolNames` puts the current one first, so the same rule `subjectDir`
           follows applies here — first name wins, and a stale copy under an old
           name can't arm a second waiter that reports the same rounds twice and
           heartbeats into a store no server owns. */
        const seen = new Set()
        for (const reviews of toolNames(TOOL.review).map(t => path.join(here, LOCAL, t))) {
          let subs = []
          try { subs = fs.readdirSync(reviews, { withFileTypes: true }) } catch {}
          for (const sub of subs) {
            if (!sub.isDirectory() || seen.has(sub.name)) continue
            if (fs.existsSync(path.join(reviews, sub.name, 'url'))) {
              seen.add(sub.name)
              found.push(path.join(reviews, sub.name))
            }
          }
        }
        continue
      }
      if (left > 0) walk(here, left - 1)
    }
  }
  walk(from, depth)
  /* A store found both ways is one review, so compare real paths rather than
     resolved ones: the walk starts from `process.cwd()`, which has its symlinks
     collapsed already, while `.serving` records the path the server was given.
     Under a symlinked prefix — `/tmp` and `/var` on macOS — the same directory
     otherwise arrives under two names and every caller sees it twice. */
  const realPath = store => { try { return fs.realpathSync(store) } catch { return path.resolve(store) } }
  return [...new Set([...found, ...pointedStores(from)].map(realPath))]
}

/* How long a stream watcher waits to be told its events are being read. Long
   enough that a session which started it mid-turn still gets there;
   `--handshake-timeout <seconds>` for a host that needs longer. */
const HANDSHAKE_MS = Math.max(1, Number(args['handshake-timeout']) || 120) * 1000
/* Live only once a stream watcher has been answered, or straight away for the
   one-shot watch, which proves itself by exiting. */
let heartbeat = null
const stopBeating = () => { heartbeat?.stop(); heartbeat = null }

/**
 * Answer a stream watcher's handshake. Only a session that can run commands can
 * do this, which is exactly what the watcher needs to know about itself.
 */
function cmdAck () {
  const waiting = readJSON(P.handshake())
  if (!waiting) {
    // Naming the directory it looked in, because the usual reason to find
    // nothing is being somewhere else: `--all` resolves the handshake from the
    // working directory, and an ack run from a different one reads a file that
    // was never there rather than the one the watcher wrote.
    console.log('Nothing to answer — no watcher is waiting on a handshake for this review.')
    console.log(`Looked in ${STORE}`)
    return
  }
  const token = args.token && args.token !== true ? String(args.token) : null
  if (token !== waiting.token) {
    console.error('That is not the token the waiting watcher printed — read its HANDSHAKE line again.')
    process.exit(2)
  }
  /* Answered, not gone. A second watcher overwrites the first one's handshake,
     so a watcher that read "the file I wrote is missing" as "someone answered
     me" would go live on an answer addressed to another process — and the one
     nobody answered would heartbeat forever. The token stays on the record, and
     only the watcher that owns it clears it. */
  writeJSON(P.handshake(), { ...waiting, answeredAt: new Date().toISOString() })
  // Whether the workspace goes Linked is the watcher's to report: it knows
  // which reviews it covers, and this command does not.
  console.log('Answered — the watcher is wired to this session. Read its next line.')
}

/**
 * `watch --stream` — the same watch, as an event stream that never ends.
 *
 * The one-shot form below has to exit to be heard, because a finished shell
 * command is often the only thing that re-invokes an idle agent session. That
 * makes re-arming a step someone has to remember, and it gets forgotten. A
 * stream is how every other file watcher works — nodemon, tsc --watch, entr —
 * and the Host op `watch_stream` consumes exactly this shape: one line of
 * stdout is one event, and the process stays up. Nothing to re-arm, and the
 * presence heartbeat no longer flickers off after every round.
 *
 *   node review-server.mjs watch --all --stream
 */
async function cmdStream (stores, label, all, subjectFlags) {
  const seen = new Map(stores.map(s => [s, { flags: new Set() }]))
  const say = line => { process.stdout.write(line + '\n') }
  say(`WATCHING  ${stores.length} review(s): ${stores.map(label).join(', ')}`)

  /* Presence is proven before it is claimed. Nothing here can tell which tool
     started this process — every host spawns children the same way — so ask for
     the one thing only a live session can do, and run a command back. The
     heartbeat starts when that lands, which is what makes the page's Linked
     mean a session is receiving this stream. */
  const token = randomBytes(4).toString('hex')
  fs.mkdirSync(STORE, { recursive: true })
  writeJSON(P.handshake(), { token, at: new Date().toISOString(), pid: process.pid })
  say(`HANDSHAKE this stream is not live until you answer it. Run now:`)
  say(`          node "${process.argv[1]}" ack ${subjectFlags} --token ${token}`)
  const askedAt = Date.now()

  /* Answered means answered *here*. A second watcher on the same review
     overwrites this record, so an answer carrying someone else's token is not
     this watcher's to act on — and only the watcher that owns the record clears
     it. Without that, the watcher nobody answered goes live too, and heartbeats
     long after the answered one has stopped. */
  const mine = () => readJSON(P.handshake())?.token === token
  const answered = () => { const record = readJSON(P.handshake()); return record?.token === token && !!record.answeredAt }

  /* The handshake proves a session is reading this stream. It says nothing
     about whether the stream reaches the review the reviewer is looking at, and
     a watcher covering no store heartbeats into nothing — so LINKED waits for a
     store to be under it, and the gap is named rather than papered over. */
  let saidLinked = false, saidUnlinked = false, answeredAt = 0
  const sayLink = () => {
    if (saidLinked || !stores.length) return
    saidLinked = true
    say('LINKED    handshake answered — the workspace says Linked from here')
  }
  /* Arming the watcher before the serve is a supported order, and a review that
     turns up a moment later needs no explaining — so the empty case is only
     worth reporting once it has had time to stop being empty. */
  const EMPTY_LINK_MS = 15_000
  const sayNoLink = () => {
    if (saidLinked || saidUnlinked || Date.now() - answeredAt < EMPTY_LINK_MS) return
    saidUnlinked = true
    say(`UNLINKED  handshake answered, but no live review is visible from ${process.cwd()},`)
    say('          so no workspace says Linked. A serve started here is picked up on its')
    say('          own; one already running for a page outside this directory is not —')
    say('          for that, start this again with the tool your adapter names for')
    say(`          watch_stream:  node "${process.argv[1]}" watch --file <page.html> --stream`)
  }

  while (true) {
    if (!heartbeat) {
      if (answered()) {
        fs.rmSync(P.handshake(), { force: true })
        answeredAt = Date.now()
        heartbeat = startHeartbeat(() => stores.map(store => inStore(store, 'watching')))
        sayLink()
      } else if (Date.now() - askedAt > HANDSHAKE_MS) {
        /* Exiting is the point: on a host where a finished background command
           re-invokes the session, this delivers itself to whoever started the
           watcher. */
        if (mine()) fs.rmSync(P.handshake(), { force: true })
        say('UNWIRED   the handshake went unanswered, so these events reach no one.')
        say('          Start this again with the Host op watch_stream, using the tool')
        say('          your Host adapter names for it.')
        return process.exit(3)
      }
    } else sayNoLink()

    for (const store of [...stores]) {
      const at = n => inStore(store, n)
      const was = seen.get(store)

      if (!fs.existsSync(at('url'))) {
        say(`CLOSED    ${label(store)} · the tab went away`)
        fs.rmSync(at('watching'), { force: true })
        stores = stores.filter(x => x !== store)
        seen.delete(store)
        continue
      }

      // Each sentinel is announced once per appearance, not once per poll.
      for (const [file, what] of [['approved', 'APPROVED '], ['share', 'SHARE    ']]) {
        if (fs.existsSync(at(file))) {
          if (!was.flags.has(file)) { say(`${what} ${label(store)} · read ${at(file)}`); was.flags.add(file) }
        } else was.flags.delete(file)
      }

      /* The tick. Anything the reviewer has written and not had back — a new
         comment, or an answer on one already in hand — is handed over here, and
         everything still open goes with it. A reply needs no separate event:
         it is the same comment, coming round again with more said on it. */
      const subject = subjectOf(store)
      if (anythingWaiting(subject)) {
        const { going, fresh } = withStoreLock(() => deliver(subject), store)
        say(`REVIEW    ${label(store)} · ${going.length} open` +
          (fresh.size ? `, ${fresh.size} new` : '') + ` · ${subject.brief}`)
      }
    }

    /* A review opened after this started should join it. Otherwise "one watcher
       for the session" only holds for the tools that happened to be up when it
       began, and the next one opened is unwatched — the same hole as forgetting
       to re-arm, arriving by a different route. */
    if (all) {
      for (const store of liveStores()) {
        if (seen.has(store)) continue
        /* Not covered here and heartbeating anyway: another session's watcher
           has it, and it joins this one only once that heartbeat is gone. */
        if (watchingRecently(inStore(store, 'watching'))) continue
        stores.push(store)
        seen.set(store, { flags: new Set() })
        say(`OPENED    ${label(store)} · now watching ${stores.length} review(s)`)
      }
      // A review that arrives after the handshake is what makes the link real.
      if (heartbeat) sayLink()
    }

    // With --all, an empty set means "no tab open right now" — keep the
    // stream and the heartbeat path alive so a later serve can OPENED in.
    // Without --all, empty means the only subject closed: done.
    if (!stores.length) {
      if (!all) { stopBeating(); say('CLOSED    nothing left to watch'); return process.exit(0) }
    }
    heartbeat?.beat()
    await new Promise(r => setTimeout(r, 1000))
  }
}

async function cmdWatch () {
  // `--file` may be given more than once; parseArgs keeps only the last, so
  // read them off the raw argv.
  const argv = process.argv.slice(2)
  const many = argv.flatMap((a, i) => a === '--file' && argv[i + 1] ? [argv[i + 1]] : [])
  // --all and --file combine: everything live in the project, plus anything
  // living outside it that you name.
  const all = args.all === true || args.all === 'true'
  /* A fresh heartbeat is another session's watcher, and covering the review
     anyway would hand the same comment to two sessions. So the sweep leaves a
     claimed store alone — it is found again the moment its watcher stops. A
     store named with `--file` is covered regardless: naming it is a deliberate
     takeover, which is how a review is adopted from a watcher that is stuck. */
  const unclaimed = store => !watchingRecently(inStore(store, 'watching'))
  let stores = [...(all ? liveStores().filter(unclaimed) : []), ...many.map(storeFor)]
  // Named subjects only. Never fall back to the placeholder STORE from
  // `watch --all` (cwd/.vstack/local/review) — that path is not a review store, and
  // treating it as one exits the stream the moment it sees no `url` file
  // (classic race: watcher armed before serve wrote its url).
  if (!stores.length && !all) stores = [STORE]
  stores = [...new Set(stores)]
  if (!stores.length && !(args.stream === true || args.stream === 'true')) {
    console.log('CLOSED — nothing to watch')
    return process.exit(0)
  }

  const label = store => path.basename(store)
  process.on('SIGINT', () => { stopBeating(); process.exit(130) })
  process.on('SIGTERM', () => { stopBeating(); process.exit(143) })
  touch()   // the page hears about it straight away

  if (args.stream === true || args.stream === 'true') {
    // Stream mode with --all and nothing live yet: wait for a serve to appear
    // instead of exiting. cmdStream's OPENED path picks new stores up.
    if (!stores.length && all) {
      process.stdout.write('WATCHING  0 review(s): waiting for a live serve…\n')
    }
    // The stream arms its heartbeat only once its handshake is answered.
    return cmdStream(stores, label, all, all ? '--all' : SUBJECT)
  }

  /* The one-shot form proves itself by exiting, which is what delivers its
     event, so it needs no handshake. `stores` shrinks as reviews close, and the
     heartbeat re-reads it every beat. */
  heartbeat = startHeartbeat(() => stores.map(store => inStore(store, 'watching')))
  console.log(`watching ${stores.length} review(s): ${stores.map(label).join(', ')}`)
  /* Exiting IS the wake-up — a running process cannot interrupt an idle agent
     session, so the only way to be called is to finish. That makes re-arming
     the easiest thing in the world to forget, and a forgotten waiter is a
     review nobody is reading. So the last thing printed is the command that
     puts it back. Prefer `watch --stream` via Host op watch_stream. */
  const rearm = `node "${process.argv[1]}" ${process.argv.slice(2).join(' ')}`
  const done = (what, store, file, detail = '') => {
    stopBeating()
    console.log(`${what}  ${label(store)}${detail}`)
    if (file) { try { console.log(fs.readFileSync(file, 'utf8')) } catch {} }
    console.log(`\nThis one-shot watch has now ended. Either restart it:\n  ${rearm}`)
    console.log(`or use the streaming form, which does not end:\n  ${rearm} --stream`)
    process.exit(0)
  }
  /* One review ending does not end the watch. A closed tab is reported and its
     review dropped; the others keep their heartbeat, because taking them all
     down over someone else's closure leaves every other page saying Unlinked
     until a human notices. The watch is over when there is nothing left. */
  while (stores.length) {
    for (const store of [...stores]) {
      const at = n => inStore(store, n)
      if (fs.existsSync(at('approved'))) return done('APPROVED', store, at('approved'))
      if (fs.existsSync(at('share')))    return done('SHARE', store, at('share'))
      const subject = subjectOf(store)
      if (anythingWaiting(subject)) {
        const { going, fresh } = withStoreLock(() => deliver(subject), store)
        return done('REVIEW', store, subject.brief,
          ` · ${going.length} open${fresh.size ? `, ${fresh.size} new` : ''}`)
      }
      if (!fs.existsSync(at('url'))) {
        console.log(`CLOSED  ${label(store)} — the tab went away`)
        fs.rmSync(at('watching'), { force: true })
        stores = stores.filter(x => x !== store)
      }
    }
    if (!stores.length) break
    await new Promise(r => setTimeout(r, 1000))
  }
  stopBeating()
  console.log('CLOSED — nothing left to watch. Nothing to re-arm.')
  process.exit(0)
}

function cmdStatus () {
  const state = loadState()
  console.log(JSON.stringify({
    reviewing: LIVE ? 'app' : 'file',
    file: FILE,
    /* Where this review's files actually are. A caller that needs one — the
       capture to share, a version to read — asks rather than assembling the
       path from the tool's current name, which is not where a review opened
       under an earlier name still lives. */
    store: STORE,
    app: appOrigin(),
    name: pageName(),
    version: state.version,
    versions: listVersions().map(v => `v${v.n}: ${v.label}`),
    comments: loadComments().map(comment => ({
      id: comment.id,
      state: comment.state,
      where: comment.sentAt ? (comment.deliveredAt ? 'with the agent' : 'queued') : 'still being written',
      note: comment.note,
    })),
    approved: fs.existsSync(P.approved()) ? readJSON(P.approved(), {}) : null,
    shareRequest: fs.existsSync(P.share()) ? readJSON(P.share(), {}) : null,
    shareUrl: loadState().shareUrl || null,
  }, null, 2))
}

/* ────────────────────────── unanswered ─────────────────────────── */

/**
 * A comment the agent was handed and has said nothing about since.
 *
 * A delivered comment is answered by closing it or by replying to it. One that
 * has neither is a round that stopped halfway, and nothing else in the protocol
 * notices: the next tick only fires when the reviewer writes again, so an
 * unanswered comment sits there for as long as they stay quiet.
 *
 * It is settled by comparing what the agent has said against what it was given,
 * not against the delivery itself: every tick re-stamps `deliveredAt` on every
 * open comment, so a comment the agent asked a question about would fall behind
 * its own delivery as soon as the reviewer wrote anything at all.
 */
const unanswered = comment => {
  if (comment.state !== 'open' || !comment.deliveredAt) return false
  const when = reply => Date.parse(reply.at || '') || 0
  const delivered = Date.parse(comment.deliveredAt)
  const latest = pick => Math.max(0, ...(comment.replies || []).filter(pick).map(when))
  // The reviewer's last word that the agent was actually handed. Anything
  // written since is waiting for the next tick rather than for the agent.
  const asked = latest(reply => reply.by === REVIEWER_ROLE && when(reply) <= delivered)
  const answered = latest(reply => reply.by !== REVIEWER_ROLE)
  return answered <= asked
}

const oneLine = note => {
  const text = String(note || '').replace(/\s+/g, ' ').trim()
  return text.length > 72 ? text.slice(0, 71) + '…' : text
}

/**
 * What the agent still owes, said as the commands that settle it. Exits 1 when
 * a round is unfinished, so a Host that can gate the end of a turn holds the
 * session open until the round is handed back.
 *
 * `--all` reads every review with a server behind it, which is also the test
 * for whether a round is in flight at all: a review whose tab has gone is over,
 * and there is nothing left to owe.
 *
 * `--session <id>` asks for one session's debt and no one else's: only comments
 * whose delivery was recorded for that id count. Without it, every unanswered
 * comment counts, whoever took it — the form for a person asking after the
 * review rather than a gate asking after itself. A delivery recorded with no
 * session is nobody's to be gated on: naming it to a session that may never
 * have seen it invites that session to close another's round, and the failure
 * this command must not have is holding the wrong turn open.
 */
function cmdUnanswered () {
  const stores = args.all === true || args.all === 'true' ? liveStores() : [STORE]
  const bin = process.argv[1]
  let owing = 0
  for (const store of stores) {
    const subject = subjectOf(store)
    const owed = loadComments(subject).filter(comment =>
      unanswered(comment) && (!SESSION || comment.deliveredTo === SESSION))
    if (!owed.length) continue
    owing += owed.length
    const them = owed.length > 1 ? 'them' : 'it'
    console.log(`Review "${subject.name}" — you took delivery of ${owed.length} comment${owed.length > 1 ? 's' : ''} and have not answered ${them}:`)
    for (const comment of owed) console.log(`  ${comment.id}  ${oneLine(comment.note)}`)
    console.log(`\nDo what each one asks and close it, or reply to ask what it means:`)
    console.log(`  node "${bin}" publish ${subject.flags} --close ${owed.map(comment => comment.id).join(',')} --label "what changed"`)
    console.log(`  node "${bin}" reply ${subject.flags} --comment ${owed[0].id} --text "your question"`)
  }
  if (!owing) console.log('Nothing outstanding — every comment you were handed is closed or answered.')
  process.exit(owing ? 1 : 0)
}

/* ───────────────────────────── serve ────────────────────────────── */

const clients = new Set()
let reloadTimer = null
/* Only when it changes — a heartbeat file ticking every two seconds is not
   worth a message every two seconds. */
startPresence(clients, agentListening).unref?.()
/* Set once the server is listening, so a request handler can end the review. */
let closeServer = null
/* Live-page bookkeeping, so the server can close itself when the tab does. */
let everConnected = false
let idleSince = null
function broadcast (event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) { try { res.write(payload) } catch {} }
}
function touch () {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => broadcast('reload', { at: Date.now() }), 120)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2',
}
const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}
const sendJSON = (res, code, obj) => send(res, code, JSON.stringify(obj), MIME['.json'])

function readBody (req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => { raw += c; if (raw.length > 32e6) { reject(new Error('body too large')); req.destroy() } })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function payload () {
  const state = loadState()
  const versions = listVersions()
  return {
    mode: LIVE ? 'live' : 'local',
    // What this server is on now. A tab opened before an update still holds the
    // version that served it, so the workspace can show both.
    version: currentVersion(),
    name: pageName(),
    fileName: LIVE ? (APP ? APP.host : state.app || '') : path.basename(FILE),
    app: appOrigin(),
    base: BASE,
    startPath: state.start || '/',
    currentVersion: state.version,
    // What the agent said about the round that just landed, if it said anything.
    summary: state.summary || null,
    // A live review has no single document to hand over — the app serves it.
    html: LIVE ? '' : fs.readFileSync(FILE, 'utf8'),
    versions,
    /* The whole list, every time. A comment carries where it is — written,
       queued, with the agent — so a reload or a second tab reads the same
       review as the tab that wrote it, with nothing to reconstruct. What the
       reviewer took off the list is the one thing left out: the record stays on
       disk so the agent holding it can still close it. */
    comments: loadComments().filter(comment => !comment.dismissedAt),
    shareUrl: state.shareUrl || null,
    shareVersion: state.shareVersion || null,
    sharePending: fs.existsSync(P.share()),
    historyClearedAt: state.historyClearedAt || null,
    /* Whether an agent session is actually waiting on this review. The link dot
       used to say "Linked" whenever the page could reach this server, which is
       a fact about the browser and the file server — not about anyone being
       there to read what you send. */
    watching: agentListening(),
  }
}

/**
 * The workspace autosaves its whole list, so a reply written here between its
 * last fetch and its next save would be lost. The stored thread wins on length,
 * and a client can never un-address a comment by accident — only deliberately,
 * by hitting Revert or Refine, which stamps `reopenedAt`.
 *
 * A save says what the client holds, not what the review contains: a comment
 * carried from an earlier version is never in the payload, and a second tab
 * knows nothing of what the first just wrote. So an id the client left out is
 * kept. Removing a comment is `dismissed`, which is a field, not an absence.
 */
/** A thread is an append-only log, so two writers can only ever add to it and
 *  the union of what they each hold is the whole of it. No copy is authoritative
 *  and none can lose a line by being stale. */
function mergeReplies (stored = [], incoming = []) {
  const byKey = new Map()
  for (const reply of [...stored, ...incoming]) {
    byKey.set(`${reply.by}|${reply.at}|${reply.text}`, reply)
  }
  return [...byKey.values()].sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0))
}

/**
 * Take what the workspace holds, and keep what it is not allowed to change.
 *
 * A comment the reviewer has sent is frozen: its words are what the agent was
 * given, so only the thread may still grow on it. Before it is sent it is still
 * theirs to rewrite. Either way the protocol's own fields are never the
 * client's to set — a save cannot close a comment, un-send it, or say it was
 * delivered — and a comment the payload does not mention is left alone, because
 * a save says what one tab holds, not what the review contains.
 */
function acceptFromReviewer (incoming) {
  const comments = loadComments()
  const byId = new Map(comments.map(comment => [comment.id, comment]))
  const at = new Date().toISOString()
  for (const raw of incoming) {
    if (!raw?.id) continue
    const stored = byId.get(raw.id)
    if (!stored) {
      const { state, deliveredAt, deliveredTo, ...rest } = raw
      const fresh = normaliseComment({ ...rest, state: 'open', deliveredAt: null, sentAt: raw.sentAt ? at : null })
      comments.push(fresh)
      byId.set(fresh.id, fresh)
      continue
    }
    const replies = mergeReplies(stored.replies, raw.replies)
    const answered = replies.length > (stored.replies || []).length &&
      replies.at(-1)?.by === REVIEWER_ROLE
    // The words are frozen once they are sent; before that the comment is still
    // a draft and the reviewer may rewrite it however they like.
    if (!stored.sentAt) {
      for (const [key, value] of Object.entries(raw)) {
        if (!OWNED.includes(key) && key !== 'replies') stored[key] = value
      }
    }
    stored.replies = replies
    if (!stored.sentAt && raw.sentAt) stored.sentAt = at
    // Answering something called done says it is not done. It is the reviewer's
    // only way back in, and it needs no separate control. Saying anything on a
    // comment puts it back on the list, including one taken off it.
    if (answered && stored.state === 'closed') {
      stored.state = 'open'
      stored.dismissedAt = null
    }
  }
  return saveComments(comments)
}

/** Keep the current snapshot, but remove every earlier snapshot. Comments stay
 * in their review folders and can be cleared independently in the workspace.
 * The current version number deliberately stays put: published links
 * and any agent already holding that number must not silently point elsewhere. */
function clearHistory () {
  const current = loadState().version
  if (fs.existsSync(P.versions())) {
    for (const file of fs.readdirSync(P.versions())) {
      const match = /^v(\d+)\.(?:html|meta\.json)$/.exec(file)
      if (match && Number(match[1]) !== current) {
        fs.rmSync(path.join(P.versions(), file), { force: true })
      }
    }
  }
  const state = loadState()
  state.historyClearedAt = new Date().toISOString()
  saveState(state)
  return true
}

function serveStatic (res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found')
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  fs.createReadStream(file).pipe(res)
}
/** Resolve a request path inside a base dir, refusing anything that escapes. */
function safeJoin (base, rel) {
  const t = path.resolve(base, '.' + path.posix.normalize('/' + rel))
  return t === base || t.startsWith(base + path.sep) ? t : null
}

/* ────────────────────────── live: the proxy ──────────────────────────
   The workspace annotates by reaching into the frame's document, which the
   browser only allows same-origin. So the app is served *through* here: the
   workspace moves aside to /__review and everything else is passed to the real
   server, which leaves the app's own absolute paths (/assets/…, /api/…)
   working exactly as they do when you open it directly.

   Only two kinds of header are touched: the ones whose whole job is to stop a
   page being framed, and a redirect back to the app's own origin, which would
   otherwise take the reviewer out of the proxy mid-flow.

   A public site needs more than a dev server does. It writes its own origin into
   its markup in absolute form — one click on `https://site.com/pricing` and the
   frame is off the proxy, cross-origin, and every comment on it stops working
   silently. So text responses are rewritten to point back through here. That is
   the only edit made to the page; nothing else about it is touched. */
const STRIP = [
  'content-security-policy', 'content-security-policy-report-only',
  'x-frame-options', 'cross-origin-opener-policy', 'cross-origin-embedder-policy',
  // Would teach the browser to force https on localhost, for every review after
  // this one.
  'strict-transport-security',
]
/** Bodies worth rewriting. Everything else streams through untouched — and an
    event stream must, or it would be buffered until the page gave up. */
const REWRITABLE = /^(text\/html|text\/css|text\/javascript|application\/(x-)?javascript|application\/json|application\/manifest\+json)/i
const upstream = () => (APP.protocol === 'https:' ? https : http)
const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/* The site's own origin, in every form it writes it: absolute, protocol-
   relative, and with the slashes escaped the way JSON encoders leave them. */
const ORIGIN_RE = new RegExp(`(https?:)?//${rx(APP ? APP.host : '')}/?`, 'g')
const ESCAPED_RE = new RegExp(`(https?:)?\\\\/\\\\/${rx(APP ? APP.host : '')}(\\\\/)?`, 'g')
const toLocal = body => body.replace(ORIGIN_RE, '/').replace(ESCAPED_RE, '\\/')

/* A service worker registered by the site would take over this whole origin —
   including the workspace — and outlive the review. Registration is refused for
   as long as the page is being reviewed; nothing else is changed. */
const NO_SW = '<script>try{if(navigator.serviceWorker)' +
  "navigator.serviceWorker.register=()=>Promise.reject(new Error('disabled during review'))}catch(e){}</script>"

function upstreamOpts (req) {
  const headers = { ...req.headers, host: APP.host }
  // The site has to see itself. A form post whose Origin says localhost is
  // exactly what a CSRF check exists to refuse.
  if (headers.origin) headers.origin = APP.origin
  if (headers.referer) headers.referer = String(headers.referer).replace(/^https?:\/\/[^/]+/, APP.origin)
  // Rewriting a body means reading it; ask for one that does not need inflating.
  headers['accept-encoding'] = 'identity'
  return {
    protocol: APP.protocol,
    hostname: APP.hostname,
    port: APP.port || (APP.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: req.url,
    headers,
    servername: APP.hostname,
    // A dev server on a self-signed cert is still the thing under review.
    rejectUnauthorized: false,
  }
}

/** Cookies are set for the site's domain; on this origin that makes them
    unsettable, which logs the reviewer out on every navigation. */
function localCookies (value) {
  return [].concat(value).map(c => String(c)
    .replace(/;\s*domain=[^;]*/ig, '')
    .replace(/;\s*partitioned/ig, ''))
}

/** Shown inside the frame when the app is not answering — the reviewer should
    learn that from the canvas, not from a blank white box. */
const downPage = e => `<!doctype html><meta charset="utf-8">
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;
font:14px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif;color:#334;background:#fbfbfd}
div{max-width:30rem;padding:2rem;text-align:center}code{background:#eef;padding:.15em .4em;border-radius:4px}
h1{font-size:1rem;margin:0 0 .5rem}p{margin:.4rem 0;color:#667}</style>
<div><h1>Can't reach ${APP.origin}</h1>
<p>The review is still open — start the app and hit reload.</p>
<p><code>${String(e && e.code || e || '')}</code></p></div>`

function proxy (req, res) {
  const up = upstream().request(upstreamOpts(req), r => {
    const h = { ...r.headers }
    for (const k of STRIP) delete h[k]
    if (h['set-cookie']) h['set-cookie'] = localCookies(h['set-cookie'])
    if (h.location) h.location = String(h.location).replace(ORIGIN_RE, '/')
    const type = String(h['content-type'] || '')
    const rewrite = REWRITABLE.test(type) && !/event-stream/i.test(type)
    if (!rewrite) {
      res.writeHead(r.statusCode || 502, r.statusMessage, h)
      return r.pipe(res)
    }
    // Held whole, because a self-origin URL can straddle any chunk boundary.
    const chunks = []
    r.on('data', c => chunks.push(c))
    r.on('end', () => {
      let body = Buffer.concat(chunks)
      const enc = String(h['content-encoding'] || '').toLowerCase()
      try {
        if (enc === 'gzip') body = zlib.gunzipSync(body)
        else if (enc === 'deflate') body = zlib.inflateSync(body)
        else if (enc === 'br') body = zlib.brotliDecompressSync(body)
      } catch { /* not what it claimed to be — pass it through as it came */ }
      if (enc) delete h['content-encoding']
      let out = toLocal(body.toString('utf8'))
      if (/text\/html/i.test(type)) out = out.replace(/<head[^>]*>/i, m => m + NO_SW)
      const buf = Buffer.from(out)
      h['content-length'] = String(buf.length)
      res.writeHead(r.statusCode || 502, r.statusMessage, h)
      res.end(buf)
    })
    r.on('error', () => res.destroy())
  })
  up.on('error', e => {
    if (res.headersSent) return res.destroy()
    send(res, 502, downPage(e), MIME['.html'])
  })
  req.pipe(up)
}

/** HMR and any other socket the app opens. Without this a dev server reconnects
    forever in the console and the page stops updating on save. */
function proxyUpgrade (req, socket, head) {
  const up = upstream().request(upstreamOpts(req))
  up.on('upgrade', (r, us, uhead) => {
    const lines = [`HTTP/1.1 ${r.statusCode} ${r.statusMessage || 'Switching Protocols'}`]
    for (const [k, v] of Object.entries(r.headers)) {
      for (const one of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${one}`)
    }
    socket.write(lines.join('\r\n') + '\r\n\r\n')
    if (uhead?.length) socket.write(uhead)
    us.on('error', () => socket.destroy())
    socket.on('error', () => us.destroy())
    us.pipe(socket).pipe(us)
  })
  up.on('error', () => socket.destroy())
  if (head?.length) up.write(head)
  up.end()
}

/** The workspace, told where it is living. Everything else about it is static. */
function serveWorkspace (res) {
  let html = fs.readFileSync(path.join(HERE, 'workspace.html'), 'utf8')
  if (BASE) html = html.replace(/<head>/i, `<head>\n<script>window.VS_BASE=${JSON.stringify(BASE)}</script>`)
  html = withVersion(withHost(html, HOST_PROFILE))
  send(res, 200, withUpdate(html, update), MIME['.html'])
}

async function handle (req, res) {
  const url = new URL(req.url, 'http://localhost')
  const raw = decodeURIComponent(url.pathname)
  // Live: the app owns the whole path space and the workspace lives under
  // BASE. Anything that is not ours belongs to the app.
  let p = raw
  if (LIVE) {
    if (raw !== BASE && !raw.startsWith(BASE + '/')) return proxy(req, res)
    p = raw.slice(BASE.length) || '/'
  }

  if (p === '/' || p === '/index.html') return serveWorkspace(res)
  if (p === '/page' && !LIVE) return serveStatic(res, FILE)
  if (p === '/api/project') {
    try { return sendJSON(res, 200, payload()) } catch (e) { return sendJSON(res, 500, { error: String(e) }) }
  }
  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write('retry: 1000\n\n')
    clients.add(res)
    everConnected = true
    idleSince = null
    // Presence rides the same stream: a waiter starting or stopping is news the
    // page needs, and it is the one change no file write announces.
    try { res.write(`event: presence\ndata: ${JSON.stringify({ watching: agentListening() })}\n\n`) } catch {}
    const ping = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 25000)
    req.on('close', () => {
      clearInterval(ping)
      clients.delete(res)
      if (!clients.size) idleSince = Date.now()
    })
    return
  }
  const vm = p.match(/^\/api\/version\/(\d+)$/)
  if (vm) {
    const f = P.version(Number(vm[1]))
    if (fs.existsSync(f)) return serveStatic(res, f)
    // A live round only has a capture if a review was sent from it. Say so in
    // the frame rather than showing a 404 where a screen should be.
    if (LIVE) {
      return send(res, 200, `<!doctype html><meta charset="utf-8">
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;
font:14px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif;color:#667;background:#fbfbfd}</style>
<p>No capture of round ${Number(vm[1])} — nothing was sent for review from it.</p>`, MIME['.html'])
    }
    return send(res, 404, '')
  }
  /**
   * The DOM as it stood when the reviewer was looking at it. A live review has
   * no file to freeze, so the workspace hands one up: it is what the timeline
   * scrubs back to, and what gets published when they ask for a shareable link.
   */
  if (p === '/api/comments' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    return withStoreLock(() => {
      const before = new Set(loadComments().filter(c => c.sentAt).map(c => c.id))
      const comments = acceptFromReviewer(body.comments || [])
      const sent = comments.filter(c => c.sentAt && !before.has(c.id))
      if (sent.length) console.log(`\n● ${sent.length} comment(s) sent — waiting for the next tick`)
      touch()
      return sendJSON(res, 200, { ok: true, comments })
    })
  }
  /* Taking a comment off the list. Nothing the agent holds is refused: one
     already delivered may be half done, and the agent finishes what it was
     given whatever the reviewer does (rule 4). So a delivered comment keeps its
     record, closed and marked dismissed — the id still resolves, so the close
     the agent is about to run is the no-op rule 5 promises. One that never left
     the workspace has no such reader, and goes outright. */
  if (p === '/api/comments/dismiss' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    return withStoreLock(() => {
      const comments = loadComments()
      const target = comments.find(comment => comment.id === body.id)
      if (!target) return sendJSON(res, 404, { error: 'No such comment' })
      if (target.deliveredAt) {
        target.dismissedAt = new Date().toISOString()
        target.state = 'closed'
        saveComments(comments)
      } else {
        saveComments(comments.filter(comment => comment.id !== body.id))
      }
      touch()
      return sendJSON(res, 200, { ok: true })
    })
  }
  /* Taking a reply back off a thread. The union merge (rule 7) means a save
     that omits a line is a stale copy, not a removal — so removal is a request
     of its own, exactly as dismissing is for a comment. Only the thread's last
     line can go, and only the reviewer's own: words the agent has answered are
     what the answer means, and stay. The agent is not told; whatever it already
     took delivery of, it finishes from (rule 4). */
  if (p === '/api/comments/unreply' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    return withStoreLock(() => {
      const comments = loadComments()
      const target = comments.find(comment => comment.id === body.id)
      if (!target) return sendJSON(res, 404, { error: 'No such comment' })
      const replies = target.replies || []
      const matches = reply => reply.by === REVIEWER_ROLE &&
        reply.at === body.at && reply.text === body.text
      if (replies.length && matches(replies.at(-1))) {
        target.replies = replies.slice(0, -1)
        saveComments(comments)
        touch()
        return sendJSON(res, 200, { ok: true })
      }
      // Still on the thread but no longer its last line: something has been
      // said since, and the words underneath an answer are not takeable-back.
      if (replies.some(matches)) return sendJSON(res, 409, { error: 'Already answered' })
      // Not found at all is already gone — a second click, or another tab.
      return sendJSON(res, 200, { ok: true })
    })
  }
  /* Give a stranded round back to the queue.
     A delivered comment is not `unseen`, so a watcher armed after the session
     behind it died blocks and hands over nothing: the round sits where no agent
     can reach it and no tick will raise it. Clearing `deliveredAt` puts those
     comments back where the state table says a sent, undelivered comment
     belongs, and the next tick takes them.
     Refused while a heartbeat says someone is listening, because then the round
     is not stranded — an agent holds it and owes an answer on it, and handing
     the same comment to a second session is the race. */
  if (p === '/api/comments/requeue' && req.method === 'POST') {
    return withStoreLock(() => {
      if (agentListening()) {
        return sendJSON(res, 409, {
          error: 'The agent is listening — it still has these. Reply on one to ask for it back.',
        })
      }
      const comments = loadComments()
      const stranded = comments.filter(comment => comment.state === 'open' && comment.deliveredAt)
      for (const comment of stranded) { comment.deliveredAt = null; comment.deliveredTo = null }
      saveComments(comments)
      touch()
      return sendJSON(res, 200, { ok: true, requeued: stranded.map(comment => comment.id) })
    })
  }
  /* Start the review over. Everything a version of this tool wrote about this
     review goes — the comments, the brief, the snapshots, and the directories a
     store filled by an older version keeps its comments in, which would
     otherwise be adopted straight back on the next read. What the review *is*
     stays: the page or app under it, and its name. */
  if (p === '/api/reset' && req.method === 'POST') {
    return withStoreLock(() => {
      cmdReset(true)
      return sendJSON(res, 200, { ok: true })
    })
  }
  if (p === '/api/history/clear' && req.method === 'POST') {
    return withStoreLock(() => {
      clearHistory()
      const data = payload()
      console.log(`\n⌫ Cleared versions before v${data.currentVersion}`)
      touch()
      return sendJSON(res, 200, {
        ok: true,
        currentVersion: data.currentVersion,
        versions: data.versions,
        historyClearedAt: data.historyClearedAt,
      })
    })
  }
  /**
   * "Give me a link I can send to someone." The workspace cannot publish a
   * public URL — only the agent via Host op `share` can — so this raises the ask
   * and waits. The agent publishes and hands the URL back with `share --url`.
   */
  /* "Not now" for the release this page was offered. Recorded next to the
     update check's own cache, because the page's memory of it dies with its
     origin — see dismissUpdate in lib/update-check.mjs. */
  if (p === '/api/update-dismissed' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    if (update && body.key === update.key) dismissUpdate(update.key)
    return sendJSON(res, 200, { ok: true })
  }
  if (p === '/api/share' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const n = Number(body.version) || loadState().version
    writeJSON(P.share(), { page: FILE || appOrigin(), app: appOrigin(), name: pageName(), version: n, at: new Date().toISOString() })
    console.log(`\n◆ Shareable link requested for v${n} — Host op share, then:`)
    console.log(`    node review-server.mjs share ${SUBJECT} --url <public-url>`)
    touch()
    return sendJSON(res, 200, { ok: true })
  }
  /**
   * Sign-off. The review is over: write the verdict and close the server, which
   * removes `url` and ends the waiter — so the same exit that means "tab closed"
   * now carries a reason, and the agent carries on with the design settled.
   */
  if (p === '/api/approve' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const n = Number(body.version) || loadState().version
    return withStoreLock(() => {
      const stillOpen = openComments()
      const expected = Number.isInteger(Number(body.expectedOpenCount))
        ? Number(body.expectedOpenCount)
        : Array.isArray(body.openComments) ? body.openComments.length : null
      if (expected !== null && expected !== stillOpen.length) {
        return sendJSON(res, 409, {
          error: 'The open-comment count changed. Review the current list before approving.',
          openComments: stillOpen,
        })
      }
      writeJSON(P.approved(), {
        page: FILE || appOrigin(), app: appOrigin(),
        name: pageName(),
        version: n,
        openComments: stillOpen,
        at: new Date().toISOString(),
      })
      const left = stillOpen.length
      console.log(`\n✓ Approved at v${n}${left ? ` — ${left} comment(s) left unapplied` : ''} — the review is closed`)
      sendJSON(res, 200, { ok: true })
      // Let the response land before the socket goes away with the process.
      setTimeout(() => closeServer && closeServer('approved'), 350)
      return
    })
  }

  // Anything the page references (images, shared css) resolves beside it.
  // Live has no page dir — everything the app asks for went to the app.
  const f = LIVE ? null : safeJoin(DIR, p)
  if (f && fs.existsSync(f) && !fs.statSync(f).isDirectory()) return serveStatic(res, f)
  const asset = safeJoin(HERE, p)
  if (asset && fs.existsSync(asset) && !fs.statSync(asset).isDirectory()) return serveStatic(res, asset)
  return send(res, 404, 'Not found')
}

/* Filled in once, before the first page goes out — see lib/update-check.mjs for
   what it does and does not do. */
let update = null

/* The workspace opens itself as the server comes up — see openInBrowser in
   lib/live-link.mjs. `--no-open`, or VSTACK_NO_OPEN=1, for a run that should
   leave the screen alone. */
const openWorkspace = target => openInBrowser(target, { skip: args['no-open'] })

async function cmdServe () {
  update = await checkForUpdate(HOST_PROFILE)
  // Where the page says "not now". The server offers the path rather than the
  // page assuming one, so a page opened off disk simply has nowhere to say it.
  // Under BASE like every other call: a live review proxies whatever is not,
  // and this would have gone to the app being reviewed.
  if (update) update.dismiss = BASE + '/api/update-dismissed'
  if (HOST_PROFILE) console.log(`  host       ${HOST_PROFILE.id} (${HOST_PROFILE.name})`)
  // Serving an unpublished page would name a version with no frozen copy. The
  // same startup transaction upgrades feedback left by a pre-ledger server.
  withStoreLock(() => {
    if (loadState().version === 0) cmdPublish(true)
  })
  {
    /* Whoever picks this store up later — publish, reply, a second serve, a
       watcher covering reviews it did not start — needs to know what this
       review is of, without being told again. It is what lets one watcher hand
       over the comments for every review it covers, and name the commands to
       answer them with. */
    const state = loadState()
    state.name = pageName()
    if (LIVE) {
      state.app = APP.origin
      if (args.start && args.start !== true) state.start = String(args.start).startsWith('/') ? args.start : '/' + args.start
    } else state.file = FILE
    saveState(state)
  }
  // Terminal signals belong to the review that raised them. A new one starts
  // clean, or the first waiter it arms fires on last week's verdict.
  fs.rmSync(P.approved(), { force: true })
  fs.rmSync(P.share(), { force: true })
  const port = Number(args.port || 7788)
  const server = http.createServer((req, res) => {
    handle(req, res).catch(e => { try { sendJSON(res, 500, { error: String(e) }) } catch {} })
  })
  if (LIVE) server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith(BASE + '/') || req.url === BASE) return socket.destroy()
    proxyUpgrade(req, socket, head)
  })
  if (!LIVE) try { fs.watch(DIR, (_e, name) => { if (name === path.basename(FILE)) touch() }) } catch {}
  // Replies written by `reply` have to reach an open workspace too.
  try { fs.mkdirSync(path.join(STORE, 'reviews'), { recursive: true }) } catch {}
  try { fs.watch(path.join(STORE, 'reviews'), { recursive: true }, () => touch()) } catch {}
  /* `share --url` and `publish` run as their own process, so the touch() they
     call reaches no clients — this one is holding them. The store is the only
     thing both sides share, so watch the files that carry news: the state
     (version, share url), the sentinel that says a link is still wanted, and
     the brief — whose deletion is the agent collecting it, the moment the
     workspace starts holding new comments back instead of sending into the
     round. Without this the menu sits on "publishing the link…" forever and
     "queued" never becomes "being worked on". */
  /* The agent writes into the same store from its own process — closing a
     comment, answering one, taking delivery — and the page has to hear about it
     without asking. */
  try { fs.watch(STORE, (_e, name) => { if (['state.json', 'share', 'comments.json'].includes(name)) touch() }) } catch {}

  server.on('error', e => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${port} is in use — a review server may already be running there.`)
      process.exit(2)
    }
    throw e
  })
  const url = `http://localhost:${port}${BASE}/`

  /* Dropping the url file tells the session's waiter the link is over, so it
     stops waiting instead of hanging until its timeout. */
  const close = why => {
    try { fs.rmSync(P.url(), { force: true }) } catch {}
    try { fs.rmSync(servingFile(process.cwd(), STORE), { force: true }) } catch {}
    console.log(`closed (${why})`)
    process.exit(0)
  }
  closeServer = close

  const idleTimeout = args['idle-timeout'] === undefined ? 90 : Number(args['idle-timeout'])
  if (idleTimeout > 0) {
    setInterval(() => {
      if (!everConnected || clients.size || idleSince === null) return
      if (Date.now() - idleSince > idleTimeout * 1000) {
        console.log(`no tab for ${idleTimeout}s — closing the review`)
        close('tab closed')
      }
    }, 2000).unref?.()
  }
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => close(sig.toLowerCase()))

  /* A site that answers the front door with a redirect somewhere else — the www
     host, a country path, a login — is a review of the wrong origin: everything
     on the other side of it is outside the proxy. Better to say so at the start
     than to let the reviewer find out by watching comments stop working. */
  if (LIVE) {
    const probe = upstream().request({ ...upstreamOpts({ method: 'GET', url: '/', headers: {} }), timeout: 6000 }, r => {
      const loc = r.headers.location
      if (r.statusCode >= 300 && r.statusCode < 400 && loc) {
        let to
        try { to = new URL(loc, APP.origin) } catch { to = null }
        if (to && to.origin !== APP.origin) {
          console.log(`\n  ⚠ ${APP.origin} redirects to ${to.origin} — that origin is outside the proxy.`)
          console.log(`    Restart with --app ${to.origin} to review the page they actually land on.`)
        }
      }
      r.resume()
    })
    probe.on('error', () => {})
    probe.on('timeout', () => probe.destroy())
    probe.end()
  }

  server.listen(port, '127.0.0.1', () => {
    fs.mkdirSync(STORE, { recursive: true })
    fs.writeFileSync(P.url(), url + '\n')
    // So `watch --all`, run from here, finds this review wherever the page lives.
    try {
      fs.mkdirSync(servingDir(process.cwd()), { recursive: true })
      writeAtomic(servingFile(process.cwd(), STORE), STORE + '\n')
    } catch {}
    console.log(`${LIVE ? 'live review' : 'wireframe'} · ${pageName()} · v${loadState().version}`)
    console.log(`  workspace  ${url}`)
    console.log(LIVE ? `  app        ${APP.origin} (proxied)` : `  page       ${FILE}`)
    if (LIVE) console.log(`  store      ${STORE}`)
    console.log(idleTimeout > 0
      ? `  ready — closes itself ${idleTimeout}s after the tab does`
      : '  ready — stays up until stopped')
    openWorkspace(url)
  })
}

switch (args._) {
  case 'publish': withStoreLock(() => cmdPublish()); break
  case 'reply': withStoreLock(cmdReply); break
  case 'ack': withStoreLock(cmdAck); break
  case 'share': withStoreLock(cmdShare); break
  case 'status': cmdStatus(); break
  case 'unanswered': cmdUnanswered(); break
  case 'reset': withStoreLock(cmdReset); break
  case 'watch': cmdWatch(); break
  case 'serve': cmdServe(); break
  default:
    console.error(`Unknown command "${args._}". Use: serve | watch | publish | reply | ack | share | status | unanswered | reset`)
    process.exit(1)
}
