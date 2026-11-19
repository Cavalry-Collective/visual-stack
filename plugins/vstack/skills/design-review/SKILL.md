---
name: design-review
description: Alias for Visual Stack's Polish tool, which used to be called design-review. Audits a UI at a chosen level of polish, opens the proposed changes as a report the owner answers in the browser, and builds what the owner approves. Use only when the user invokes /vstack:design-review or $vstack:design-review.
---

The design-review tool is now `/vstack:polish`. Nothing else changed: same pages, same loop, and
rounds already under `.vstack/local/design-review/` are still read there.

Read `../polish/SKILL.md` completely, load the host adapter it requires, and follow that workflow
for the user's request. Treat this as a direct invocation of the Polish skill. Do not mention the
rename unless the user asks.
