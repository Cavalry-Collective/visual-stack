#!/usr/bin/env node
/*
 * check-version.mjs — "does this pull request ship what it changed?"
 *
 * A host decides an update exists by comparing the `version` in plugin.json on
 * main against the version it installed. Everything under plugins/ reaches a
 * user the moment it lands on main, so a change there that leaves the version
 * alone ships to nobody: the code is live, and every installed copy still
 * believes it is current.
 *
 * Nothing downstream can catch that. The release is already out by then, and
 * the repair is another release. So it is caught here, on the pull request,
 * while there is still one commit to add.
 *
 * Run on a pull request with BASE_SHA set to the base of the branch.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { headingIndex } from "./changelog.mjs"

const MANIFEST = "plugins/vstack/.claude-plugin/plugin.json"
const CHANGELOG = "CHANGELOG.md"
const SHIPPED_TO_USERS = "plugins/"
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

const git = (...args) => execFileSync("git", args, { encoding: "utf8" })

const fail = (...lines) => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

const parse = (version, where) => {
  const match = SEMVER.exec(version ?? "")
  if (!match) fail(`${where} declares ${JSON.stringify(version)}, which is not a MAJOR.MINOR.PATCH version.`)
  return match.slice(1, 4).map(Number)
}

const isHigher = (candidate, current) => {
  for (let part = 0; part < 3; part++) {
    if (candidate[part] !== current[part]) return candidate[part] > current[part]
  }
  return false
}

const base = process.env.BASE_SHA
if (!base) fail("BASE_SHA is not set, so there is nothing to compare this branch against.")

const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean)
const shipped = changed.filter(file => file.startsWith(SHIPPED_TO_USERS))

if (shipped.length === 0) {
  console.log(`Nothing under ${SHIPPED_TO_USERS} changed, so this ships nothing and needs no version.`)
  process.exit(0)
}

const declared = JSON.parse(readFileSync(MANIFEST, "utf8")).version
// A branch that adds the manifest has nothing to be higher than.
let previous = null
try {
  previous = JSON.parse(git("show", `${base}:${MANIFEST}`)).version
} catch {
  console.log(`${MANIFEST} does not exist at the base of this branch.`)
}

if (previous !== null && !isHigher(parse(declared, MANIFEST), parse(previous, `${MANIFEST} at the base`))) {
  fail(
    `${shipped.length} file(s) under ${SHIPPED_TO_USERS} changed, and every one of them reaches a user`,
    `as soon as this merges. This branch declares ${declared} against ${previous} on the base, so no`,
    "host will offer the update and the change ships to nobody.",
    "",
    "Raise `version` in BOTH host manifests and add the matching CHANGELOG.md entry:",
    "  plugins/vstack/.claude-plugin/plugin.json",
    "  plugins/vstack/.codex-plugin/plugin.json",
    "",
    "MAJOR for a breaking change to a skill name, an on-disk path, or a protocol.",
    "MINOR for new behaviour. PATCH for a fix.",
    "",
    "Changed here:",
    ...shipped.map(file => `  ${file}`),
  )
}

if (headingIndex(readFileSync(CHANGELOG, "utf8").split("\n"), declared) === -1) {
  fail(
    `${CHANGELOG} has no entry for ${declared}, and that entry is published as the release notes.`,
    "",
    `Add a section starting "## ${declared}" above the previous release.`,
  )
}

console.log(`Ships ${declared}, and ${CHANGELOG} says what is in it.`)
