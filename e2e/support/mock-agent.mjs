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

export function closeAndPublish (world, notes, label, summary) {
  const ids = notes.map(note => world.idFor(note)).join(',')
  const args = ['publish', ...world.subjectArgs(), '--close', ids]
  if (label) args.push('--label', label)
  if (summary) args.push('--summary', summary)
  return world.cli(...args)
}

/** A question the reviewer answers by picking, with one option recommended. */
export function askWithOptions (world, note, text, options, recommend) {
  const argv = ['reply', ...world.subjectArgs(), '--comment', world.idFor(note), '--text', text]
  for (const option of options) argv.push('--option', option)
  if (recommend) argv.push('--recommend', String(recommend))
  const run = world.cli(...argv)
  assert.equal(run.status, 0, run.stderr)
  return run
}

export function reply (world, note, text) {
  const run = world.cli('reply', ...world.subjectArgs(), '--comment', world.idFor(note), '--text', text)
  assert.equal(run.status, 0, run.stderr)
}

export function unanswered (world) {
  return world.cli('unanswered', '--all')
}
