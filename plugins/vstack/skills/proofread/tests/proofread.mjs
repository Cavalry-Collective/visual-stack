#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(SKILL_DIRECTORY, 'assets', 'proofread.mjs')
const PAGE_DIRECTORY = path.join(SKILL_DIRECTORY, 'assets', 'page')

const proofread = (...commandArguments) => spawnSync(process.execPath, [CLI, ...commandArguments], { encoding: 'utf8' })
const parses = script => spawnSync(process.execPath, ['--check', '--input-type=module'], { input: script, encoding: 'utf8' }).status === 0

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-proofread-test-'))

try {
  const copyText = '# Guide\n\nUse `run` and [the docs](https://example.com/docs).\n'
  const copyPath = path.join(temp, 'guide.md')
  fs.writeFileSync(copyPath, copyText)

  // State follows the workdir rule, beside the copy and under .vstack/local.
  const prepared = proofread('prepare', copyPath)
  assert.equal(prepared.status, 0, prepared.stderr)
  const runDirectory = prepared.stdout.trim()
  assert.equal(runDirectory, path.join(temp, '.vstack', 'local', 'proofread', 'guide'))

  // The insert script carries the copy, the prompt, and the copy's digest, and is valid JavaScript.
  const insertScript = fs.readFileSync(path.join(runDirectory, 'insert.js'), 'utf8')
  const prompt = fs.readFileSync(path.join(SKILL_DIRECTORY, 'assets', 'prompt.md'), 'utf8').trim()
  assert.ok(!/__[A-Z0-9_]+__/.test(insertScript), 'every placeholder is filled')
  assert.ok(insertScript.includes(JSON.stringify(copyText)), 'the copy is embedded exactly')
  assert.ok(insertScript.includes(JSON.stringify(prompt)), 'the prompt is embedded')
  assert.ok(insertScript.includes(createHash('sha256').update(copyText).digest('hex')), 'the digest is of the copy')
  assert.ok(parses(insertScript), 'the insert script parses')

  // Copy saved inside .vstack uses that directory rather than nesting a second one.
  const savedCopyPath = path.join(temp, '.vstack', 'local', 'proofread', 'copy.md')
  fs.writeFileSync(savedCopyPath, copyText)
  assert.equal(proofread('prepare', savedCopyPath).stdout.trim(), path.join(temp, '.vstack', 'local', 'proofread', 'copy'))

  // The copy's own `$` sequences and backticks survive rendering.
  const trickyText = 'Cost $& and $1 and $`\n```\ncode\n```\n'
  const trickyPath = path.join(temp, 'tricky.md')
  fs.writeFileSync(trickyPath, trickyText)
  const trickyDirectory = proofread('prepare', trickyPath).stdout.trim()
  const trickyScript = fs.readFileSync(path.join(trickyDirectory, 'insert.js'), 'utf8')
  assert.ok(trickyScript.includes(JSON.stringify(trickyText)), '$ sequences are not treated as patterns')
  assert.ok(parses(trickyScript), 'tricky copy still parses')

  // Every page script parses, as the host will run it.
  for (const name of fs.readdirSync(PAGE_DIRECTORY)) {
    const source = fs.readFileSync(path.join(PAGE_DIRECTORY, name), 'utf8').replace(/__[A-Z0-9_]+__/g, '""')
    assert.ok(parses(source), `${name} parses`)
  }

  // Adapters speak hosts: the skill names ops, never a host's tools.
  const skill = fs.readFileSync(path.join(SKILL_DIRECTORY, 'SKILL.md'), 'utf8')
  for (const toolName of ['mcp__', 'claude-in-chrome', 'Monitor', 'javascript_tool', 'switch_browser']) {
    assert.ok(!skill.includes(toolName), `SKILL.md must not name ${toolName}`)
  }

  // Every host adapter says what user_browser is on that host.
  for (const host of ['claude', 'codex', 'grok']) {
    const adapter = fs.readFileSync(path.join(SKILL_DIRECTORY, '..', 'review', 'hosts', `${host}.md`), 'utf8')
    assert.ok(adapter.includes('`user_browser`'), `${host} adapter covers user_browser`)
  }

  // Bad usage fails with the usage line.
  const misuse = proofread('nonsense', copyPath)
  assert.equal(misuse.status, 2)
  assert.ok(misuse.stderr.includes('Usage'))

  console.log('proofread: ok')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
