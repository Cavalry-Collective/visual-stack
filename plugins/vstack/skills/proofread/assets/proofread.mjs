#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subjectDir, TOOL } from '../../../lib/workdir.mjs'

const ASSETS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const INSERT_SCRIPT_FILE = 'insert.js'

const read = filePath => fs.readFileSync(filePath, 'utf8')

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

function prepare (copyPath) {
  const copyText = read(copyPath)
  const runDirectory = runDirectoryFor(copyPath)
  fs.writeFileSync(path.join(runDirectory, INSERT_SCRIPT_FILE), fillPlaceholders(read(path.join(ASSETS_DIRECTORY, 'page', 'insert.js')), {
    COPY: copyText,
    PROMPT: read(path.join(ASSETS_DIRECTORY, 'prompt.md')).trim(),
    COPY_SHA256: createHash('sha256').update(copyText).digest('hex'),
  }))
  console.log(runDirectory)
}

const [commandName, copyPath, ...extraArguments] = process.argv.slice(2)
if (commandName !== 'prepare' || !copyPath || extraArguments.length > 0) {
  console.error('Usage: proofread.mjs prepare <copy-file>')
  process.exit(2)
}
prepare(copyPath)
