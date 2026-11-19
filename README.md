<img src="docs/assets/vstack-lockup-tile-1120.png" alt="Visual Stack" width="420">

# Visual Stack

[![CI](https://github.com/Cavalry-Collective/visual-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/Cavalry-Collective/visual-stack/actions/workflows/ci.yml)
[![Security](https://github.com/Cavalry-Collective/visual-stack/actions/workflows/security.yml/badge.svg)](https://github.com/Cavalry-Collective/visual-stack/actions/workflows/security.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Cavalry-Collective/visual-stack/badge)](https://scorecard.dev/viewer/?uri=github.com/Cavalry-Collective/visual-stack)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<!-- Hidden until each one reports green again.
     Sonar has not analysed the repository since v5.0.0: the quality gate is
     not computed and the security rating is still the E it was left on.

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=Cavalry-Collective_visual-stack&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Cavalry-Collective_visual-stack)
[![Security rating](https://sonarcloud.io/api/project_badges/measure?project=Cavalry-Collective_visual-stack&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Cavalry-Collective_visual-stack)
-->


## It’s easier to show than explain.

Visual Stack is a collection of tools to help you review, polish, and build with your agent, right on the screen.

[![A mind map of Visual Stack under the heading Pick a tool. Visual Stack sits in the middle. Review branches to the left, run with /vstack:review. Polish branches to the right, run with /vstack:polish. User story map hangs below, run with /vstack:user-story-map and marked Experimental.](docs/assets/stack-map.svg)](#review)

## Review

Review works with new wireframes and running apps, at desktop, tablet and phone sizes.

<img src="docs/assets/wireframe-demo.gif" alt="Review demo on a todo app. The reviewer pins a comment, drags a box over the task list, strikes out words in a button and sends all three. The agent publishes the next version into the same tab." width="600">

[Read about Review →](docs/review.md)

## Polish

Polish audits your UI and shows what could be improved, with before-and-after screenshots for each proposed fix.

<img src="docs/assets/polish-demo.gif" alt="Polish demo on a todo app. The audit ticks off its four tasks, the owner approves three findings shown as before and after slides, and then finishes the round." width="600">

[Read about Polish →](docs/polish.md)

## Get started

Both tools come in one plugin.

### Claude Code

Install in Claude Code:

```text
/plugin marketplace add Cavalry-Collective/visual-stack
/plugin install vstack@cavalry-collective
```

Then run Review:

```text
/vstack:review Wireframe a desktop personal task manager with minimal aesthetics.
```

Or run Polish:

```text
/vstack:polish Audit the checkout page on localhost:3000.
```

### Codex<sup>1</sup>

Install in your terminal:

```text
codex plugin marketplace add Cavalry-Collective/visual-stack
codex plugin add vstack@cavalry-collective
```

Then run Review:

```text
$vstack:review Wireframe a desktop personal task manager with minimal aesthetics.
```

Or run Polish:

```text
$vstack:polish Audit the checkout page on localhost:3000.
```

<sup>1</sup> Codex support is experimental. Codex has no background monitor that keeps a two-way link open, so Visual Stack has the agent check in at short intervals. Occasionally the agent stops checking too early. If that happens, ask it to resume watching.

## Requirements

- A current version of Claude Code or Codex
- A supported Node.js LTS release
- Git
- A local web browser
- At least one strong opinion about border radius

## Security

Installing this plugin runs its code on your machine, so every change to `main` passes a set of scans before it lands: static analysis, a secret scan over the whole history, a workflow audit, and a code-quality gate. The badges above report the last run. [SECURITY.md](SECURITY.md) says what each gate enforces and how to report a vulnerability.

## Contribute

Visual Stack is open source and under active development. Expect rough edges, breaking changes, and occasional moments of character development.

- [Report an idea or bug](https://github.com/Cavalry-Collective/visual-stack/issues)
- [Read the contribution guide](CONTRIBUTING.md)
- [Report a security issue](SECURITY.md)

---

Built by [DeyangChan](https://github.com/DeyangChan), presumably after one too many rounds of screenshot-based feedback. Released by [Cavalry Collective](https://cavalry.sg).

Licensed under the [MIT License](LICENSE).
