#!/usr/bin/env node
/*
 * round-gate.mjs — the Stop hook that keeps a review round from ending halfway.
 *
 * Claude Code is the one Host that can gate the end of a turn, so this sits
 * outside the engine with the rest of the host-specific wiring. It decides
 * nothing itself: `review-server.mjs unanswered` owns what an unfinished round is,
 * and this turns its answer into the block Claude Code understands.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.join(HERE, '..', 'skills', 'review', 'assets', 'review-server.mjs')

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
let input = {}
try { input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch {}

/* One block per turn. The gate names what is missing once; a session that means
   to stop with a round open — because the reviewer asked it to — must still be
   able to. Nothing is lost either way: an unanswered comment stays open and
   comes back on the next delivery. */
if (input.stop_hook_active) process.exit(0)

/* The payload names the session this Stop belongs to, and `unanswered` answers
   for that session alone — a second session in the same directory must not be
   told it owes a round its watcher never took delivery of. */
const session = input.session_id ? ['--session', String(input.session_id)] : []
const check = spawnSync(process.execPath, [SERVER, 'unanswered', '--all', ...session], {
  cwd: input.cwd || process.cwd(), encoding: 'utf8', timeout: 5000,
})

/* Exit 1 with something to say is the only answer that blocks. A check that
   could not run knows nothing about the round, and a hook that turned a broken
   check into a stuck turn would be the worse failure by far. */
if (check.status !== 1 || !check.stdout?.trim()) process.exit(0)

console.log(JSON.stringify({
  decision: 'block',
  reason: `A review round is open and you have not handed it back.\n\n${check.stdout.trim()}`,
}))
