/*
 * Finding a release's section in CHANGELOG.md.
 *
 * Both the pull-request check and the release publisher need the same answer,
 * so the heading is recognised in one place. Matching is done on plain strings
 * rather than by building a pattern out of the version: a version is data, and
 * a pattern built from data is only ever as correct as its escaping.
 */

/** True when this line is the heading for exactly this version. A heading runs
 *  `## 6.4.0 — 2026-08-09`, so anything may follow the number as long as the
 *  number itself ends there — `## 6.4.01` is a different release. */
export const isHeadingFor = (line, version) => {
  const heading = `## ${version}`
  if (!line.startsWith(heading)) return false
  const next = line.slice(heading.length)[0]
  return next === undefined || !(next === "." || (next >= "0" && next <= "9"))
}

/** The line index of that heading, or -1. */
export const headingIndex = (lines, version) =>
  lines.findIndex(line => isHeadingFor(line, version))

/**
 * Everything under this version's heading, up to the next release heading.
 * Null when the changelog has no entry for it.
 */
export const sectionFor = (changelog, version) => {
  const lines = changelog.split("\n")
  const start = headingIndex(lines, version)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const next = rest.findIndex(line => line.startsWith("## "))
  return (next === -1 ? rest : rest.slice(0, next)).join("\n").trim()
}
