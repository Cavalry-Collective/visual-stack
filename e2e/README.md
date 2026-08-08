# End-to-end suite

Gherkin scenarios that drive the review loop end to end: the real
`review-server.mjs` and its CLI, with reviewer actions going through the same
HTTP API the workspace uses.

No model is involved. The agent role is played by `support/mock-agent.mjs`,
which runs the same CLI commands a real session would (`watch`, `publish`,
`reply`, `unanswered`) — the protocol never sees who is typing, so the mock is
a complete stand-in for Claude or Codex. Each scenario gets its own temp
directory and port. The `@browser` scenarios additionally drive the workspace
UI in a headless Chromium via Playwright.

## Run it

```bash
npm ci
npx playwright install chromium     # once, for the @browser scenarios
npx cucumber-js                     # VSTACK_HOST=claude (default)
VSTACK_HOST=codex npx cucumber-js   # same suite under the Codex profile
```

CI runs both hosts on every pull request (`E2E (claude)` and `E2E (codex)`
checks), with a result summary on the run page.

## Tags

| Tag | Meaning |
| --- | --- |
| `@round1` | Drives the server API and CLI headlessly. Runs by default. |
| `@browser` | Drives the workspace UI in Chromium via Playwright. Runs by default. |
| `@agent` | Puts a real model session behind the loop; costs money, excluded by default. |

The defaults are set in `cucumber.mjs`.

## Layout

| Path | Role |
| --- | --- |
| `features/*.feature` | The scenarios, one file per feature |
| `steps/review.steps.mjs` | Step definitions for the protocol scenarios |
| `steps/browser.steps.mjs` | Step definitions for the `@browser` scenarios |
| `support/world.mjs` | Per-scenario server, temp dir, and helpers |
| `support/mock-agent.mjs` | The agent role, as CLI calls |
| `support/browser.mjs` | Chromium lifecycle for `@browser` scenarios |

This is the only directory in the repo with a `package.json`. It stays outside
`plugins/` so the plugin ships without dependencies.
