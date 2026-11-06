# Lenses

Use these lenses to find weaknesses. Apply each one that fits the work and the polish level, and skip the rest. The goal is a specific finding about this product, so do not report a lens because it exists.

| Level | Lenses |
|---|---|
| **Clean** | Hierarchy, Type, Colour, Components, Space and depth (space only), Navigation and controls, The core object in depth, States, Phone, Copy, Accessibility, Code health |
| **Refined** | All of Clean, plus depth and Motion |
| **Showcase** | All of Refined, plus Delight |

## Hierarchy

- On the product's main object, such as a card, row or message, what do you read first? It should be the thing the user came for.
- Count the competing label styles on one surface. Five styles in 90px means nothing leads.
- Does a word repeat next to an icon that already says it, hundreds of times per page?

## Type

- List every font size in use. Nine sizes between 8.5px and 14px is a compressed scale. Propose about five stops, with nothing under 11px.
- Keep monospace for tabular content: dates, counts and times.
- Check contrast on small text and on tinted backgrounds, for each client or theme colour.

## Colour

- Give each colour one meaning. If red means brand, overdue, read-only and focus, a user cannot learn it. Propose a token per meaning.
- If everything is alarmed, nothing is. Escalate by degree: plain, then amber near the deadline, then red text, then a filled pill when very late.
- Are colours hard-coded outside the token file?
- Do tints hold up with each client colour in both themes? Yellow and teal often turn muddy.

## Components

- Do similar things share one family? Five chip treatments on one card look like five designers.
- Propose one atom with named tones, and add its specimen to the design guide if the repo has one.
- Do sheets share one width and one anchor? Do menus share one entrance?

## Space and depth

- Measure how much of the viewport shows work and how much shows empty blocks.
- Add up the fixed chrome: top bars, sticky heads, footers. How much height remains on a 13-inch laptop?
- Permanent chrome for an occasional action should shrink until needed.
- Does each surface level earn its fill and shadow? Save the larger shadow for hover, drag and open states.

## Navigation and controls

- Icon-only controls with tooltip names are hard to learn. Propose a labelled control, with active filters shown as removable chips.
- Does the top row fit at 1280px and 1440px with the real number of tabs? Hidden tabs need a visible way to reach them.
- Rare actions, such as sign out, do not belong in the most valuable corner.
- Does anything look like a different control? A moon beside a date reads as a theme toggle.

## The core object in depth

- Open the main detail view. Do the title and the close control stay visible while scrolling?
- Are the main actions reachable without scrolling? Destructive actions belong in an overflow menu.
- Do fields have groups, or do they all carry equal weight?
- Is long pasted content clamped?
- Does the most important input look like an input?

## States

Check each one: loading, error, empty, no match, read-only, signed out.

- Does the skeleton match the shipped layout, so the real content lands without a jump?
- Does the chrome claim data that failed to load, such as "All 0" over an error?
- Does a blank value read as a failed render, such as a lone dash?
- Does each loading area have a placeholder, or does a grey box or an empty tile appear first?

## Phone

- Is there a layout designed for the phone, or the desktop layout scrolling sideways?
- Can a thumb reach everything? A 6px dot cannot be aimed at.
- Does a feature disappear with no replacement on small screens?

## Motion

Build a table of interaction, today and proposed. Cover hover, fold or expand, filter and tab changes, menus, sheets, toasts, counts, and drag.

- Find what snaps. Often the main move glides and everything around it does not.
- Use the product's existing easing curve and give durations in milliseconds.
- Check `prefers-reduced-motion`, and pause endless animation in hidden tabs.

## Delight

- Treat playful touches as features. If a work tool has a moment of fun, assume the owner wants it.
- Fix execution problems and keep the idea: token colours, one transform, a pause when hidden.
- Look for a moment that deserves more, such as finishing a task.
- Propose special effects where they add meaning, and say when each one runs and how long it lasts.

## Copy

- Do labels name the action and say what happens next, such as "Later tonight" in place of "Later"?
- Does a number have context, such as "7 closed, typical 4"?
- Does the same content appear formatted in one place and raw in another?

## Accessibility

- Can the main object be opened with Enter and Space?
- Do groups of controls have the right roles and arrow-key movement?
- Is the focus ring visible, and does it avoid sharing a colour with a warning?

## Code health

Report only what would block or undo the polish.

- Do stylesheets define the same selector more than once? New rules on top of stacked overrides will not hold. Consolidate first, and check for owner decisions inside the overrides before folding them in.
- Does expensive measuring run on every render?
- Are dead rules left over from removed features?
