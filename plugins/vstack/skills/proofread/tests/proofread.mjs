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

const firstLine = result => result.stdout.split('\n')[0]

// Runs a page script in Node with a stand-in for the page's window.
function runInPage (script, storedReply) {
  const harness = `const window = { __proofreadReply: ${JSON.stringify(storedReply)} }\nconst result = ${script}\nconsole.log(JSON.stringify(result))`
  const run = spawnSync(process.execPath, ['--input-type=module'], { input: harness, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-proofread-test-'))

try {
  const copyText = '# Guide\n\nUse `run` and [the docs](https://example.com/docs).\n'
  const copyPath = path.join(temp, 'guide.md')
  fs.writeFileSync(copyPath, copyText)

  // State follows the workdir rule, beside the copy and under .vstack/local.
  const prepared = proofread('prepare', copyPath)
  assert.equal(prepared.status, 0, prepared.stderr)
  const [runDirectory, ...insertPaths] = prepared.stdout.trim().split('\n')
  assert.equal(runDirectory, path.join(temp, '.vstack', 'local', 'proofread', 'guide'))
  assert.deepEqual(insertPaths, [path.join(runDirectory, 'insert-1.js')], 'short copy is one batch')
  assert.equal(fs.readFileSync(path.join(runDirectory, 'source.md'), 'utf8'), copyText, 'the source is kept for restore')

  // The insert script carries the copy, the prompt, and the copy's digest, and is valid JavaScript.
  const insertScript = fs.readFileSync(insertPaths[0], 'utf8')
  const prompt = fs.readFileSync(path.join(SKILL_DIRECTORY, 'assets', 'prompt.md'), 'utf8').trim()
  assert.ok(!/__[A-Z0-9_]+__/.test(insertScript), 'every placeholder is filled')
  assert.ok(insertScript.includes(JSON.stringify(copyText)), 'the copy is embedded exactly')
  assert.ok(insertScript.includes(JSON.stringify(prompt)), 'the prompt is embedded')
  assert.ok(insertScript.includes(createHash('sha256').update(copyText).digest('hex')), 'the digest is of the copy')
  assert.ok(parses(insertScript), 'the insert script parses')

  // Copy saved inside .vstack uses that directory rather than nesting a second one.
  const savedCopyPath = path.join(temp, '.vstack', 'local', 'proofread', 'copy.md')
  fs.writeFileSync(savedCopyPath, copyText)
  assert.equal(firstLine(proofread('prepare', savedCopyPath)), path.join(temp, '.vstack', 'local', 'proofread', 'copy'))

  // The copy's own `$` sequences survive rendering, and a fenced code block is replaced by a numbered line.
  const trickyText = 'Cost $& and $1 and $`\n```\ncode\n```\n'
  const trickyPath = path.join(temp, 'tricky.md')
  fs.writeFileSync(trickyPath, trickyText)
  const trickyDirectory = firstLine(proofread('prepare', trickyPath))
  const trickyBatch = fs.readFileSync(path.join(trickyDirectory, 'batch-1.md'), 'utf8')
  assert.equal(trickyBatch, 'Cost $& and $1 and $`\n[code block 1]\n', 'the code block is replaced')
  const trickyScript = fs.readFileSync(path.join(trickyDirectory, 'insert-1.js'), 'utf8')
  assert.ok(trickyScript.includes(JSON.stringify(trickyBatch)), '$ sequences are not treated as patterns')
  assert.ok(parses(trickyScript), 'tricky copy still parses')

  // Long copy splits at blank lines into batches of at most 12,000 characters, and a rerun replaces the old batches.
  const paragraph = 'Plain sentence. '.repeat(60).trim()
  const longPath = path.join(temp, 'long.md')
  fs.writeFileSync(longPath, Array.from({ length: 30 }, () => paragraph).join('\n\n'))
  const [longDirectory, ...longInserts] = proofread('prepare', longPath).stdout.trim().split('\n')
  assert.ok(longInserts.length >= 3, 'long copy is split')
  const longBatches = longInserts.map((_, index) => fs.readFileSync(path.join(longDirectory, `batch-${index + 1}.md`), 'utf8'))
  assert.ok(longBatches.every(batch => batch.length <= 12000), 'each batch fits the limit')
  assert.equal(longBatches.join('\n\n'), fs.readFileSync(longPath, 'utf8'), 'batches cover the copy in order')
  fs.writeFileSync(longPath, paragraph)
  proofread('prepare', longPath)
  assert.ok(!fs.existsSync(path.join(longDirectory, 'batch-2.md')), 'a rerun removes stale batches')

  // Verify rejects a truncated reply, and its page script accepts only the exact reply stored in the page.
  const replyText = '# Guide\n\nRun `run` and read the docs.\n'
  const replyPath = path.join(runDirectory, 'reply-1.md')
  fs.writeFileSync(replyPath, 'Start of reply [TRUNCATED]')
  const truncated = proofread('verify', replyPath)
  assert.equal(truncated.status, 1)
  assert.ok(truncated.stderr.includes('[TRUNCATED]'))
  fs.writeFileSync(replyPath, replyText)
  const verified = proofread('verify', replyPath)
  assert.equal(verified.status, 0, verified.stderr)
  const verifyScript = fs.readFileSync(verified.stdout.trim(), 'utf8')
  assert.deepEqual(runInPage(verifyScript, replyText), { verified: true, length: replyText.length })
  assert.deepEqual(runInPage(verifyScript, `${replyText}More text`), { verified: false, storedLength: replyText.length + 9, savedLength: replyText.length, firstDifference: replyText.length })
  assert.equal(runInPage(verifyScript, undefined).verified, false, 'no stored reply fails')

  // Restore repairs what ChatGPT breaks: a wrapping fence, escaped frontmatter, bold headings, code blocks, and links.
  const sourceText = '---\ntitle: Guide\n---\n\n# Guide\n\nRead [the docs](https://example.com/docs).\n\n```bash\nnpm test\n```\n\nSee [the API](https://example.com/api).\n'
  const sourcePath = path.join(temp, 'restore.md')
  fs.writeFileSync(sourcePath, sourceText)
  const restoreDirectory = firstLine(proofread('prepare', sourcePath))
  assert.equal(proofread('restore', restoreDirectory).status, 1, 'restore needs a reply for every batch')
  fs.writeFileSync(path.join(restoreDirectory, 'reply-1.md'), '```markdown\n\\---\ntitle: Guide\n\\---\n\n# **Guide**\n\nRead the docs.\n\n\\[code block 1\\]\n\nThe API is described elsewhere.\n```')
  const restored = proofread('restore', restoreDirectory)
  assert.equal(restored.status, 0, restored.stderr)
  const report = JSON.parse(restored.stdout)
  assert.equal(fs.readFileSync(report.restored, 'utf8'), '---\ntitle: Guide\n---\n\n# Guide\n\nRead [the docs](https://example.com/docs).\n\n```bash\nnpm test\n```\n\nThe API is described elsewhere.\n')
  assert.equal(report.codeBlocksRestored, 1)
  assert.deepEqual(report.codeBlocksMissing, [])
  assert.equal(report.linksRestored, 1)
  assert.deepEqual(report.linksNotFound, ['[the API](https://example.com/api)'], 'a link whose text is gone is reported')

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
