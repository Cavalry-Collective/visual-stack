/*
 * live-link.mjs — the plumbing every live-link server shares.
 *
 * The review server and the JSON bridge speak the same file protocol: live
 * push heartbeats, bounded pull leases, presence events that repeat them to the
 * page, and atomic writes so a reader never sees half a file. The protocol
 * lives here so its timing and write invariants cannot drift between engines.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

/** Write-then-rename, so a concurrent reader sees the old file or the new one,
    never a torn one. */
export function writeAtomic (file, text) {
  const tmp = file + '.tmp-' + process.pid
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}

/** "0", "false" and "" are how people write off, not on. */
const truthy = v => v !== undefined && v !== false && !/^(0|false|)$/i.test(String(v))

/**
 * Show the page the server just started serving. These tools are things you
 * look at, and a URL sitting in a log is a step between the person and the
 * thing they asked for — so the server opens it the moment it is ready.
 *
 * Best effort by design. A machine with no browser to hand — a container, an
 * ssh session — has already been told the URL, and the server goes on serving
 * it. Callers print the URL first, then call this; VSTACK_NO_OPEN=1 (or a
 * caller's own flag) skips it.
 */
export function openInBrowser (url, { skip = false } = {}) {
  if (truthy(skip) || truthy(process.env.VSTACK_NO_OPEN)) return
  const [cmd, argv] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]]
  try {
    const child = spawn(cmd, argv, { stdio: 'ignore', detached: true })
    child.on('error', () => {})   // no such command — the printed URL stands
    child.unref()
  } catch {}
}

/**
 * Put a script tag into a page, whatever shape the page is. Some of these
 * files are whole documents and some are fragments — a `.replace(/<head>/)`
 * on the second kind silently does nothing, which is a lousy way to find out
 * a feature is off.
 */
export function injectHead (html, tag) {
  if (!tag) return html
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => m + '\n' + tag)
    : tag + html
}

/* A heartbeat file is touched every couple of seconds by a watcher and deleted
   when it stops. A heartbeat rather than a flag, because the waiter can be
   killed without a chance to tidy up, and a stale marker claiming someone is
   listening is worse than no marker at all. Staleness is one protocol-wide
   number: a writer beating every BEAT_MS is comfortably inside STALE_MS. */
export const WATCH_BEAT_MS = 2000
export const WATCH_STALE_MS = 15000
/* Pull hosts prove attention one bounded wait at a time. Their lease is longer
   than a normal wait (25s), so a prompt re-arm never flickers the workspace to
   Unlinked; if the agent stops calling back, it expires without a process
   pretending the session is still there. */
export const PULL_LEASE_MS = 45000

/** Is a watcher alive behind this heartbeat file right now? */
export function watchingRecently (file) {
  try { return Date.now() - fs.statSync(file).mtimeMs < WATCH_STALE_MS } catch { return false }
}

/** Is a bounded pull consumer still inside the lease its last wait proved? */
export function leasedRecently (file) {
  try { return Date.now() - fs.statSync(file).mtimeMs < PULL_LEASE_MS } catch { return false }
}

/** Renew one pull lease without starting a timer (claim and other quick ops). */
export function renewLease (file) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, String(Date.now()))
  } catch {}
}

/**
 * Keep heartbeat files fresh until stopped. `getFiles` is read on every beat,
 * so a watcher whose subject list changes underneath it stays truthful.
 * Returns { beat, stop } — callers wire their own signals, because what a
 * signal means (exit code, cleanup order) belongs to them.
 */
export function startHeartbeat (getFiles) {
  const beat = () => {
    for (const file of getFiles()) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, String(Date.now()))
      } catch {}
    }
  }
  const timer = setInterval(beat, WATCH_BEAT_MS)
  beat()
  return {
    beat,
    stop () {
      clearInterval(timer)
      for (const file of getFiles()) fs.rmSync(file, { force: true })
    },
  }
}

/**
 * Renew a pull consumer's lease while its bounded wait is active. Stopping the
 * timer deliberately leaves the marker behind: its age, not process cleanup,
 * is what lets the next wait bridge the small gap between tool calls and what
 * makes an abandoned Codex turn become Unlinked by itself.
 */
export function startLease (getFiles) {
  const renew = () => {
    for (const file of getFiles()) renewLease(file)
  }
  const timer = setInterval(renew, WATCH_BEAT_MS)
  renew()
  return {
    renew,
    stop () { clearInterval(timer) },
  }
}

/**
 * Tell every SSE client who is listening, only when the answer changes. With
 * `keepalive`, quiet ticks still send an SSE comment so the connection is its
 * own tab-alive signal. Returns the interval so a caller can unref it.
 */
export function startPresence (clients, isWatching, { keepalive = false } = {}) {
  let last = null
  return setInterval(() => {
    const now = isWatching()
    if (now === last) {
      if (!keepalive) return
      for (const c of clients) { try { c.write(': keepalive\n\n') } catch {} }
      return
    }
    last = now
    const line = `event: presence\ndata: ${JSON.stringify({ watching: now })}\n\n`
    for (const c of clients) { try { c.write(line) } catch {} }
  }, 3000)
}
