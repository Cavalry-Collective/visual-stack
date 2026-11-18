# Lenses

Review the product as a senior UI/UX designer would. Clean and Refined find defects against the checks below, and each check passes or fails. Showcase does not check anything. It proposes flair that makes the product memorable.

Each level includes every level below it.

| Level | What you do | How you work |
|---|---|---|
| **Clean** | Find what looks wrong. | Read screenshots at 320, 375, 768, 1280, 1440 and 1920 px, and resize between them. |
| **Refined** | Find what behaves wrong. | Drive every flow. |
| **Showcase** | Propose flair. | Start from what the brand already owns. |

## Recommending a level

Recommend the level that would help this product most now. Take one desktop and one phone screenshot of the main screen, and spend no more than a few minutes.

- Recommend **Clean** if two or more Clean checks fail at a glance, such as text clipping on the phone or several unrelated font sizes.
- Recommend **Refined** if the screen looks right.
- Recommend **Showcase** if the screen looks right and a click through its main flow behaves.

Give a reason the owner can see in the picture, such as "The phone layout clips the menu and the type uses seven sizes."

## Modes

Each level has checks for both modes, plus checks for one mode only.

| Mode | What it is | What matters most |
|---|---|---|
| **Website** | A site that markets or informs, such as a company site, a landing page, a blog or docs. Most visitors come once. | The first impression, reading comfort, and a clear route to contact or sign up. |
| **Web app** | A product people sign in to and use again and again, such as a portal, a dashboard or an admin tool. | Density, predictable behaviour, every data state handled, and speed on repeated tasks. |

Pick the mode for each flow:

- A product can have both modes.
- Sign-in, sign-up, checkout and account screens are Web app, even when they open on a marketing page. The page behind them stays Website.
- A shop is Website while browsing and Web app from the cart onward.
- If you are unsure, say why, and pick the mode of the flow the owner named.
- Say in your first reply which mode each flow got, and save it as `mode` in the answers file.

## How to report a failed check

- Name the check by its ID, such as R8, in the chat reply. The report names it in plain words.
- Give the evidence: a screenshot, a measured value, and the location in the code.
- For a behaviour finding, the before picture is the frame where it goes wrong, such as the spinner in the middle of a click.
- Skip a check that does not apply, such as the form checks on a site with no forms.
- Report a code problem, such as a selector defined twice or a hard-coded colour, only inside the finding it blocks.

## Clean: looks right

### Both modes

- **C1 · Hierarchy.** The reading order is clear: first, second, third. Size, weight and colour set the order. Each view has one primary action.
- **C2 · Spacing.** The same role uses the same value everywhere: the page's side margin, card padding, the gap between cards and the gap between sections. Values come from the product's spacing scale, in 4 px steps if it has none. Padding inside a box is equal left and right. Nothing touches the edge of its container or the screen.
- **C3 · Grouping.** Related items sit closer than unrelated ones. The gap between a label and its input is smaller than the gap between fields, which is smaller than the gap between sections.
- **C4 · Alignment.** Every element lines up with a grid column or a shared edge. The page uses one container width. An icon sits visually centred on the text beside it. Labels in one row share a baseline.
- **C5 · Type.** No more than two font families. Every size is on the product's type scale, or on a scale of about five sizes if it has none. No size is under 12 px. Body text is at least 16 px on a website and at least 14 px in a web app, with a line height between 1.4 and 1.6.
- **C6 · Colour.** Each status colour has one meaning. If the brand colour is also the error colour, offer the fix as variations, one of which keeps the brand colour. Text has at least 4.5:1 contrast, and large text at least 3:1. Status never depends on colour alone.
- **C7 · Link style.** All text links share one style, and nothing else uses it.
- **C8 · Components.** Each kind of component looks the same everywhere it appears. All buttons share one set of heights, radii and padding. The same applies to inputs, cards, chips and menus.
- **C9 · Imagery.** The product uses one icon set with one stroke weight. Images are sharp and never stretched. Images in the same role share one aspect ratio and crop.
- **C10 · Responsive.** At each listed width, and while resizing between them:
  - nothing scrolls sideways, clips or overlaps;
  - stacked columns still read in the right order;
  - tables, tab rows and navigation collapse in a designed way;
  - no fixed or sticky bar covers content;
  - popovers fit a phone screen or become a sheet;
  - on a wide screen, content neither stretches to full width nor sits off-centre;
  - a tap target is at least 44 × 44 px on touch layouts.
- **C11 · Long content.** Long names and Chinese text do not break the layout or get clipped.
- **C12 · Copy.** Compare the same words across every screen:
  - a label names the action, such as "Verify email" in place of "Continue";
  - the same thing has the same name everywhere, such as "Terms & Conditions" on every screen;
  - the same data is formatted the same way everywhere;
  - there are no typos and no stray punctuation.

### Website

- **CW1 · First screen.** The first screen says what the product is, who it is for, and the one next action. At 375 px, the headline and the call to action show without scrolling. Promo bars and the header together take no more than a quarter of the screen.
- **CW2 · Reading.** A line of body text holds 45 to 75 characters.
- **CW3 · Sections.** Each section makes one point.

### Web app

- **CA1 · Consistent frame.** The navigation, page title, page actions and primary action sit in the same place on every screen.
- **CA2 · Density.** Fixed bars leave at least two thirds of the height of a 1280 × 800 screen for the work. Rows in a list or table share one height.
- **CA3 · Tables.** Numbers are right-aligned with equal-width digits. Text is left-aligned. Each header lines up with its column.

## Refined: works right

Drive the product as a user would:

- throttle the network, so loaders have time to show;
- click every link and button;
- submit each form empty, then again with wrong values;
- open every menu, modal and state;
- press Back and refresh.

### Both modes

- **R1 · Links and buttons.** A control that goes somewhere is a real link, so Cmd-click and middle-click open a new tab. A control that does something is a button.
- **R2 · Linkable text.** These are always links:
  - terms and conditions, and privacy policies;
  - phone numbers, with `tel:`;
  - email addresses, with `mailto:`;
  - WhatsApp numbers, with `wa.me`;
  - street addresses, linked to a map.
- **R3 · Navigation.**
  - The navigation shows where the user is, and the logo goes home.
  - A new page opens at the top, and an anchor link lands below the sticky header.
  - No link is broken, and every page and state offers a next step.
  - Each page title matches its page.
- **R4 · Menus and overlays.** Menus, popovers and modals close on Esc, on a click outside, and after navigation. A hover menu stays open while the pointer moves into it.
- **R5 · Form fields.** A form asks only for what it needs. Every field has a visible label, and clicking the label focuses the field. A placeholder shows an example and never repeats the label. Each input sets the right `type`, `autocomplete` and `inputmode`. Paste works in every field, including one-time codes.
- **R6 · Validation.**
  - An error first appears when the user leaves the field or submits, never while they are typing.
  - Once an error shows, it clears as soon as the value is valid.
  - Each error sits under its field and says how to fix it.
- **R7 · Submit.**
  - The submit button stays enabled until it is pressed.
  - Pressing it with errors shows every error and scrolls to the first one.
  - Enter submits.
  - A failed submit keeps everything the user typed, and says what went wrong and what to do.
  - A successful submit shows a confirmation.
- **R8 · Loading, by action.**
  - **Links:** a link opens its page straight away, with no spinner or request first.
  - **Toggles:** a toggle, such as a bookmark, changes at once, with no loader.
  - **Overlays and tabs:** a modal, menu or tab opens at once. Its content may load inside it.
  - **Submits:** a submit shows a loader on the pressed control only. That control keeps its label and size, its neighbours do not move, and it ignores a second press. No other control shows a loader.
  - **Everywhere:** no loader flashes and vanishes, and no two loaders show at once or one after another.
- **R9 · No jarring loads.**
  - The page never goes blank or flashes white between pages.
  - Updating part of a page never reloads the whole page.
  - Images reserve their space before they arrive.
  - Text does not change font after it has appeared.

  Report what the user sees. Do not report a slow endpoint or a timing figure.
- **R10 · Control states.**
  - Every control has hover, pressed, focus and disabled states.
  - A loading control keeps its normal colour. It does not also grey out.
  - A control on a cooldown looks disabled and says when it will be ready.
- **R11 · No library defaults.** No library default ships, such as Ant Design's spinner or its empty-state image. The product uses one branded loader everywhere.

### Website

- **RW1 · Conversion.** The main call to action and a way to make contact are one click away on every page. A cookie banner never covers the call to action or the content.
- **RW2 · Interruptions.** No pop-up, chat bubble or newsletter prompt appears before the visitor scrolls or clicks.
- **RW3 · Dead ends.** A wrong URL shows a branded page with a route home.
- **RW4 · Shared links.** Each page has its own description and share image, so a link pasted into WhatsApp or Slack shows a correct preview. The site has a favicon.

### Web app

- **RA1 · Sign-in.** Each step shows where the user is, and lets them go back or change what they entered. After sign-in, the user lands where they were heading, and the header shows they are signed in.
- **RA2 · URL state.** Back, refresh and a shared link all restore the same tab, filter and open record. Back closes an open modal.
- **RA3 · Refresh.** A refresh keeps the old content on screen until the new content arrives. A skeleton matches the real layout.
- **RA4 · States.**
  - Loading, empty, error, no match, read-only and signed-out states are each designed.
  - An empty or no-match state says what to do next, such as how to clear a filter.
  - No label claims data that failed to load, such as "All 0" over an error.
  - A destructive action asks for confirmation or offers Undo.
- **RA5 · Failures.** A lost connection says so and recovers without a reload. An expired session keeps what the user typed, and returns them to the same place after sign-in.
- **RA6 · Unsaved work.** Leaving a form with edits warns first. A saved change shows without a reload.
- **RA7 · Lists.** A long list can be searched, sorted and filtered, and it pages or scrolls without losing its header. Active filters show, and each one can be removed.

## Showcase: add flair

Clean and Refined list the defects. Showcase proposes what makes the product memorable.

1. **Name the concept.** Write one sentence that names the creative idea. Take it from what the brand already owns: its characters, illustration, shapes, colour or voice. Every proposal expresses that idea.
2. **Propose four to six enhancements.** Each one is a section of the report.
3. **Make one of them a major change.** Offer it as a bold variation and a restrained one.
   - On a website, it changes the first screen.
   - In a web app, it changes the home screen, onboarding or the moment a main task is finished.

Look beyond motion:

- **First screen.** Rethink the composition, display type or entrance so the page could only belong to this brand.
- **Type.** Use display type with character for headlines and key numbers.
- **Illustration and characters.** Bring the brand's characters and shapes into the interface: loaders, empty states, success screens and the 404 page.
- **Colour and composition.** Use bolder colour fields, unexpected crops, or layouts that break the grid on purpose.
- **Depth.** Use layered shadows that lift on hover, drag and open, with gradients, glass or texture where they suit the brand.
- **Motion.** Make state changes move with character. Choreograph items that move together.
- **Moments.** Make the moments that matter feel earned: finishing a task, signing up, or reaching an empty state.
- **Voice.** Give microcopy the brand's personality, in headlines, empty states, errors and confirmations.

Where the flair goes depends on the mode:

- **Website.** Spend it on the first screen, scroll storytelling, illustration and display type. A visitor comes once, so the first impression carries most of the weight.
- **Web app.** Spend it on first use, empty states, success moments and state changes. Keep the screens people use all day calm and fast.

Do not propose fade-up on scroll, scale on hover, parallax or confetti unless the concept calls for it.

Build rules:

- Give the trigger, the duration in milliseconds and the easing for anything that moves.
- Give `prefers-reduced-motion` a calm version.
- An effect must not delay the first screen, make a tap feel slow, or bring back a jarring load.
- Keep large effects off tasks that users repeat many times a day.
- Show motion as a strip of three frames in the after picture.
