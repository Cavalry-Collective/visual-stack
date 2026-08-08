/*
 * The agent, mocked. The protocol never sees a model: the agent's whole
 * surface is the CLI plus edits to the page, so these functions are a complete
 * stand-in for Claude or Codex. Only the @agent-tagged scenarios put a real
 * session behind the loop.
 */
import assert from 'node:assert/strict'

/** One tick: block until there is something to hand over, take it, and exit. */
export function takeDelivery (world) {
  const run = world.cli('watch', ...world.subjectArgs())
  assert.match(run.stdout, /REVIEW/, `expected a delivery, got:\n${run.stdout}${run.stderr}`)
  world.lastDelivery = run.stdout
  return run.stdout
}

export function closeAndPublish (world, notes, label) {
  const ids = notes.map(note => world.idFor(note)).join(',')
  const args = ['publish', ...world.subjectArgs(), '--close', ids]
  if (label) args.push('--label', label)
  return world.cli(...args)
}

export function reply (world, note, text) {
  const run = world.cli('reply', ...world.subjectArgs(), '--comment', world.idFor(note), '--text', text)
  assert.equal(run.status, 0, run.stderr)
}

export function unanswered (world) {
  return world.cli('unanswered', '--all')
}
