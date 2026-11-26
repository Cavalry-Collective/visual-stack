#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subjectDir, TOOL } from '../../../lib/workdir.mjs'

const ASSETS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
// ChatGPT does not return much more than about 13,000 characters in one reply.
const BATCH_CHARACTER_LIMIT = 12000
const SOURCE_FILE = 'source.md'
const RESTORED_FILE = 'restored.md'
const TRUNCATION_MARKER = '[TRUNCATED]'
const GENERATED_FILE = /^(?:(?:batch|reply)-\d+\.md|(?:insert|verify-reply)-\d+\.js|source\.md|restored\.md)$/
const FENCE_OPENING = /^([ \t]*)(`{3,}|~{3,})/
const PLACEHOLDER_LINE = /^[ \t]*\\?\[code block (\d+)\\?\][ \t]*$/gm
const MARKDOWN_LINK = /!?\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/

const read = filePath => fs.readFileSync(filePath, 'utf8')
const sha256 = text => createHash('sha256').update(text).digest('hex')
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function fail (message) {
  console.error(message)
  process.exit(1)
}

function runDirectoryFor (copyPath) {
  const resolved = path.resolve(copyPath)
  const directory = subjectDir(path.dirname(resolved), TOOL.proofread, path.basename(resolved, path.extname(resolved)))
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

// A replacement function keeps `$` sequences in the copy from being read as replacement patterns.
const fillPlaceholders = (script, values) =>
  Object.entries(values).reduce(
    (filled, [name, value]) => filled.replace(`__${name}__`, () => JSON.stringify(value)),
    script,
  )

const pageScript = name => read(path.join(ASSETS_DIRECTORY, 'page', name))

// An unclosed fence stays in the copy, because Markdown renders it as text to the end anyway.
function replaceCodeBlocks (text) {
  const lines = text.split('\n')
  const codeBlocks = []
  const sentLines = []
  for (let index = 0; index < lines.length; index++) {
    const opening = lines[index].match(FENCE_OPENING)
    const closing = opening && new RegExp(`^[ \\t]*${escapeRegExp(opening[2][0])}{${opening[2].length},}[ \\t]*$`)
    const closingIndex = opening ? lines.findIndex((line, candidate) => candidate > index && closing.test(line)) : -1
    if (closingIndex === -1) {
      sentLines.push(lines[index])
      continue
    }
    codeBlocks.push(lines.slice(index, closingIndex + 1).join('\n'))
    sentLines.push(`${opening[1]}[code block ${codeBlocks.length}]`)
    index = closingIndex
  }
  return { sentText: sentLines.join('\n'), codeBlocks }
}

// A paragraph longer than the limit becomes a batch of its own.
function splitIntoBatches (text) {
  const batches = []
  for (const paragraph of text.split(/\n[ \t]*\n/)) {
    const last = batches.length - 1
    if (last >= 0 && batches[last].length + 2 + paragraph.length <= BATCH_CHARACTER_LIMIT) batches[last] += `\n\n${paragraph}`
    else batches.push(paragraph)
  }
  return batches
}

function prepare (copyPath) {
  const copyText = read(copyPath)
  const runDirectory = runDirectoryFor(copyPath)
  for (const name of fs.readdirSync(runDirectory)) if (GENERATED_FILE.test(name)) fs.rmSync(path.join(runDirectory, name))
  fs.writeFileSync(path.join(runDirectory, SOURCE_FILE), copyText)

  const prompt = read(path.join(ASSETS_DIRECTORY, 'prompt.md')).trim()
  const insertScripts = splitIntoBatches(replaceCodeBlocks(copyText).sentText).map((batchText, index) => {
    const batchNumber = index + 1
    fs.writeFileSync(path.join(runDirectory, `batch-${batchNumber}.md`), batchText)
    const insertScript = path.join(runDirectory, `insert-${batchNumber}.js`)
    fs.writeFileSync(insertScript, fillPlaceholders(pageScript('insert.js'), { COPY: batchText, PROMPT: prompt, COPY_SHA256: sha256(batchText) }))
    return insertScript
  })
  console.log([runDirectory, ...insertScripts].join('\n'))
}

function verify (replyPath) {
  const batchNumber = path.basename(replyPath).match(/^reply-(\d+)\.md$/)?.[1]
  if (!batchNumber) fail('The reply file must be named reply-<batch>.md.')
  const replyText = read(replyPath)
  if (replyText.includes(TRUNCATION_MARKER)) fail(`${replyPath} contains ${TRUNCATION_MARKER}. Read that range again in smaller slices.`)
  const verifyScript = path.join(path.dirname(replyPath), `verify-reply-${batchNumber}.js`)
  fs.writeFileSync(verifyScript, fillPlaceholders(pageScript('verify-reply.js'), { REPLY: replyText, REPLY_SHA256: sha256(replyText) }))
  console.log(verifyScript)
}

const unwrapFence = text => text.trim().match(/^```[^\n]*\n([\s\S]*)\n```$/)?.[1] ?? text

function restoreLinks (text, sourceText, report) {
  let restored = text
  for (const [link, linkText, url] of sourceText.matchAll(MARKDOWN_LINK)) {
    if (restored.includes(`](${url}`)) continue
    const plainIndex = [...restored.matchAll(new RegExp(escapeRegExp(linkText), 'g'))]
      .map(match => match.index)
      .find(index => restored[index - 1] !== '[')
    if (plainIndex === undefined) {
      report.linksNotFound.push(link)
      continue
    }
    restored = restored.slice(0, plainIndex) + link + restored.slice(plainIndex + linkText.length)
    report.linksRestored++
  }
  return restored
}

function restoreCodeBlocks (text, codeBlocks, report) {
  const restoredNumbers = new Set()
  const restored = text.replace(PLACEHOLDER_LINE, (placeholder, number) => {
    const codeBlock = codeBlocks[Number(number) - 1]
    if (codeBlock === undefined || restoredNumbers.has(number)) return placeholder
    restoredNumbers.add(number)
    return codeBlock
  })
  report.codeBlocksRestored = restoredNumbers.size
  report.codeBlocksMissing = codeBlocks.map((_, index) => index + 1).filter(number => !restoredNumbers.has(String(number)))
  return restored
}

function restore (runDirectory) {
  const sourceText = read(path.join(runDirectory, SOURCE_FILE))
  const fileNames = fs.readdirSync(runDirectory)
  const batchCount = fileNames.filter(name => /^batch-\d+\.md$/.test(name)).length
  const replyFiles = Array.from({ length: batchCount }, (_, index) => path.join(runDirectory, `reply-${index + 1}.md`))
  const missingReplies = replyFiles.filter(replyFile => !fs.existsSync(replyFile))
  if (missingReplies.length > 0) fail(`Missing reply files: ${missingReplies.join(', ')}`)

  const report = { codeBlocksRestored: 0, codeBlocksMissing: [], linksRestored: 0, linksNotFound: [], frontmatterAdded: false }
  let text = replyFiles.map(replyFile => unwrapFence(read(replyFile)).trim()).join('\n\n')
  text = text.replace(/^\\---[ \t]*$/gm, '---')
  if (!/^#{1,6}[ \t]+\*\*/m.test(sourceText)) text = text.replace(/^(#{1,6})[ \t]+\*\*(.+)\*\*[ \t]*$/gm, '$1 $2')

  const sourceFrontmatter = sourceText.match(FRONTMATTER)?.[0]
  if (sourceFrontmatter && !text.startsWith('---\n')) {
    text = `${sourceFrontmatter}\n${text}`
    report.frontmatterAdded = true
  }

  text = restoreLinks(text, sourceText, report)
  text = restoreCodeBlocks(text, replaceCodeBlocks(sourceText).codeBlocks, report)
  const restoredFile = path.join(runDirectory, RESTORED_FILE)
  fs.writeFileSync(restoredFile, `${text.trimEnd()}\n`)
  console.log(JSON.stringify({ restored: restoredFile, ...report }, null, 2))
}

const COMMANDS = { prepare, verify, restore }
const [commandName, target, ...extraArguments] = process.argv.slice(2)
if (!Object.hasOwn(COMMANDS, commandName) || !target || extraArguments.length > 0) {
  console.error('Usage: proofread.mjs prepare <copy-file> | verify <run-directory>/reply-<batch>.md | restore <run-directory>')
  process.exit(2)
}
COMMANDS[commandName](target)
