#!/usr/bin/env node
/*
 * update-check: a Host that says it can detect an update actually gets one.
 *
 * Every way this feature fails is silence — the wrong profile flag, an install
 * this copy cannot recognise, a clone mistaken for an install — and silence is
 * also what "you are up to date" looks like. So the banner is observed here
 * rather than reasoned about.
 *
 * No network: the answer cache is seeded ahead of the call, so `ask` is inside
 * its TTL and never reaches GitHub.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../')
const profile = id => JSON.parse(fs.readFileSync(path.join(PLUGIN, 'host-profiles', `${id}.json`), 'utf8'))
const VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8')).version
const LATEST = '99.0.0'

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'vstack-update-'))
/* Read at import time, so both must be in place before anything is loaded. */
process.env.HOME = path.join(sandbox, 'home')
process.env.TMPDIR = path.join(sandbox, 'tmp')
fs.mkdirSync(process.env.TMPDIR, { recursive: true })
delete process.env.VSTACK_NO_UPDATE_CHECK

/* Where `codex plugin add` puts a release: one directory per version, which is
   the only record Codex keeps of what it installed. */
const installed = path.join(process.env.HOME, '.codex/plugins/cache/cavalry-collective/vstack', VERSION)
fs.mkdirSync(installed, { recursive: true })
for (const part of ['lib', 'host-profiles', '.claude-plugin']) {
  fs.cpSync(path.join(PLUGIN, part), path.join(installed, part), { recursive: true })
}

const cache = path.join(process.env.HOME, '.vstack', 'update-check.json')
fs.mkdirSync(path.dirname(cache), { recursive: true })
const seed = extra => fs.writeFileSync(cache, JSON.stringify({ at: Date.now(), kind: 'version', value: LATEST, ...extra }))
seed({})

const asCodexInstall = await import(pathToFileURL(path.join(installed, 'lib/update-check.mjs')).href)

// The run that first hears about a release keeps it to itself; the next one says so.
assert.equal(await asCodexInstall.checkForUpdate(profile('codex')), null, 'first sighting is held back')

const banner = await asCodexInstall.checkForUpdate(profile('codex'))
assert.ok(banner, 'Codex install is offered the update')
assert.equal(banner.key, LATEST)
assert.equal(banner.pill, 'update')
/* The commands are the Codex ones, not the `/plugin` fallback: printing Claude
   Code slash commands to a Codex user is worse than printing nothing. */
assert.deepEqual(banner.install, [
  'codex plugin marketplace upgrade cavalry-collective',
  'codex plugin add vstack@cavalry-collective',
])
assert.ok(!banner.install.some(line => line.startsWith('/')), 'no slash commands in a Codex banner')
assert.equal(banner.auto, null)

// "Not now" is remembered for that release, and survives the ephemeral port.
asCodexInstall.dismissUpdate(LATEST)
assert.equal(await asCodexInstall.checkForUpdate(profile('codex')), null, 'a dismissed release stops asking')

seed({ met: LATEST })
// A Host with nothing to compare against is never asked the question.
assert.equal(await asCodexInstall.checkForUpdate(profile('grok')), null, 'updateDetect none stays quiet')

/* This clone is not an install under any profile, so working on the plugin
   never produces a banner about the branch in front of you. */
const asClone = await import(pathToFileURL(path.join(PLUGIN, 'lib/update-check.mjs')).href)
assert.equal(await asClone.checkForUpdate(profile('codex')), null, 'a clone is not a Codex install')
assert.equal(await asClone.checkForUpdate(profile('claude')), null, 'a clone is not a Claude install')

fs.rmSync(sandbox, { recursive: true, force: true })
console.log('update check: ok')
