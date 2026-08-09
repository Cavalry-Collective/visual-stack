#!/usr/bin/env node
/*
 * publish-release.mjs — tag main at the version it declares, and publish it.
 *
 * The plugin is distributed by the repository itself, so merging to main is
 * what ships it. The tag and the GitHub release are the record of what shipped,
 * written from what is already in the tree: the version in plugin.json and its
 * CHANGELOG.md entry.
 *
 * Keyed on the tag rather than the diff, so it is safe to re-run and does not
 * care how the commit reached main. A commit whose version is already tagged
 * publishes nothing.
 *
 * Run on a push to main with GH_TOKEN set.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { sectionFor } from "./changelog.mjs"

const MANIFEST = "plugins/vstack/.claude-plugin/plugin.json"
const CHANGELOG = "CHANGELOG.md"

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" })

const version = JSON.parse(readFileSync(MANIFEST, "utf8")).version
const tag = `v${version}`

try {
  gh("release", "view", tag, "--json", "tagName")
  console.log(`${tag} is already published. Nothing to do.`)
  process.exit(0)
} catch {
  // No release under that tag yet, which is the case this runs for.
}

// Everything under this version's heading. Written by a person, so it is
// published as-is rather than regenerated from commits.
const notes = sectionFor(readFileSync(CHANGELOG, "utf8"), version)

if (notes === null) {
  console.error(`${CHANGELOG} has no entry for ${version}, so there are no notes to publish.`)
  console.error("A pull request cannot merge without one, so this commit did not come through one.")
  process.exit(1)
}

gh(
  "release", "create", tag,
  "--target", process.env.GITHUB_SHA,
  "--title", tag,
  "--notes", notes,
)

console.log(`Published ${tag}.`)
