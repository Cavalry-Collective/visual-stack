export default {
  import: ['support/**/*.mjs', 'steps/**/*.mjs'],
  // @agent spends money on a real model session, so it runs only when asked
  // for by tag. @browser scenarios run by default and need Chromium once:
  // npx playwright install chromium
  tags: 'not @agent',
  format: ['progress'],
}
