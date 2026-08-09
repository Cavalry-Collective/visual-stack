/*
 * The shell's palette is a copy of the design guide's, because a page has to
 * work with no external request and so cannot import one. A copy drifts, and a
 * drifted copy is two greys that were meant to be one. This asserts they agree.
 *
 * Only the roles the shell exposes are checked, and only their colours, radius
 * and mono stack — the values a hand edit is most likely to change. Composite
 * shadows are built from the guide's steps rather than aliased, so they are
 * checked for containing those steps rather than for equality.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../..')
const GUIDE = path.join(REPO, 'design/tokens.css')
const SHELL = path.join(REPO, 'plugins/vstack/lib/shell/tokens.css')

/** Every `--name: value` in one block, in source order. */
function declarations (css) {
  const found = new Map()
  for (const [, name, value] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    found.set(name, value.replace(/\s+/g, ' ').trim())
  }
  return found
}

/** The body of a rule, by the selector that opens it. */
function block (css, selector) {
  const at = css.indexOf(selector)
  assert.notEqual(at, -1, `${selector} is not in the stylesheet`)
  const open = css.indexOf('{', at)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`${selector} is never closed`)
}

/** A value with every var() followed through to something literal.

    Compared on meaning, not on spelling: the shell writes `rgba(23,19,32,.08)`
    where the guide writes `rgba(23, 19, 32, 0.08)`, and neither is more correct
    than the other. Both sides go through this, so dropping whitespace and the
    leading zero cannot hide a real difference. */
function resolve (value, scope) {
  let out = value
  for (let pass = 0; pass < 10 && out.includes('var('); pass++) {
    out = out.replace(/var\((--[a-z0-9-]+)\)/g, (whole, name) => scope.get(name) ?? whole)
  }
  return out.replace(/\s+/g, '').replace(/(^|[^0-9])0\./g, '$1.').toLowerCase()
}

const guideCss = fs.readFileSync(GUIDE, 'utf8')
const shellCss = fs.readFileSync(SHELL, 'utf8')

/* The shell role each guide role is carried as. */
const ROLES = {
  '--paper': '--ground',
  '--surface': '--background',
  '--surface-2': '--muted',
  '--ink': '--foreground',
  '--ink-2': '--foreground-2',
  '--ink-3': '--muted-foreground',
  '--line': '--border',
  '--line-2': '--border-strong',
  '--brand': '--primary',
  '--brand-soft': '--primary-subtle',
  '--brand-line': '--primary-border',
  '--ok': '--success',
  '--ok-soft': '--success-subtle',
}

/* Shape and type do not change with the theme, so they are stated once in the
   default block rather than in each. */
const CONSTANTS = {
  '--radius': '--radius-2',
  '--mono': '--font-family-mono',
}

/* A rem radius in the guide is px in the shell — the shell is stamped into
   pages whose root font size it does not control. */
const asShellValue = (role, value) =>
  role === '--radius' ? `${parseFloat(value) * 16}px` : value

const themes = [
  { name: 'light', guide: ':root {', shell: ':root[data-theme=light]{' },
  { name: 'dark', guide: ':root[data-theme="dark"] {', shell: ':root[data-theme=dark]{' },
]

let checked = 0
for (const theme of themes) {
  const guideScope = declarations(block(guideCss, theme.guide))
  // Dark restates the semantic tier only; primitives still come from :root.
  const base = declarations(block(guideCss, ':root {'))
  for (const [name, value] of base) if (!guideScope.has(name)) guideScope.set(name, value)

  const shellScope = declarations(block(shellCss, theme.shell))

  for (const [shellRole, guideRole] of Object.entries(ROLES)) {
    const want = asShellValue(shellRole, resolve(`var(${guideRole})`, guideScope))
    const got = resolve(shellScope.get(shellRole) ?? '', shellScope)
    assert.ok(shellScope.has(shellRole), `the shell has no ${shellRole} in ${theme.name}`)
    assert.equal(got, want,
      `${theme.name} ${shellRole} is ${got}, but ${guideRole} in design/tokens.css is ${want}`)
    checked++
  }

  /* Elevation is composed rather than aliased: one step for a raised edge, two
     for a popped one, the top two for a window. */
  const shadow = step => resolve(`var(${step})`, guideScope)
  assert.equal(resolve(shellScope.get('--shadow'), shellScope), shadow('--shadow-1'),
    `${theme.name} --shadow is not the guide's raised step`)
  for (const [role, steps] of [['--shadow-pop', ['--shadow-1', '--shadow-2']],
    ['--window-shadow', ['--shadow-2', '--shadow-3']]]) {
    const got = resolve(shellScope.get(role), shellScope)
    for (const step of steps) {
      assert.ok(got.includes(shadow(step)),
        `${theme.name} ${role} does not carry ${step} (${shadow(step)})`)
    }
    checked++
  }
}

/* The default :root and the explicit light choice must agree, or a page that
   never sets data-theme looks different from one that chooses light. */
const auto = declarations(block(shellCss, ':root{'))
const light = declarations(block(shellCss, ':root[data-theme=light]{'))
for (const role of Object.keys(ROLES)) {
  assert.ok(light.has(role), `the light palette has no ${role}`)
  assert.equal(auto.get(role), light.get(role),
    `${role} differs between the default palette and the light one`)
}

const guideRoot = declarations(block(guideCss, ':root {'))
for (const [shellRole, guideRole] of Object.entries(CONSTANTS)) {
  const want = asShellValue(shellRole, resolve(`var(${guideRole})`, guideRoot))
  const got = resolve(auto.get(shellRole) ?? '', auto)
  assert.equal(got, want,
    `${shellRole} is ${got}, but ${guideRole} in design/tokens.css is ${want}`)
  checked++
}

console.log(`design tokens: ok (${checked} roles across light and dark)`)
