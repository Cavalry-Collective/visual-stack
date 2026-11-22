# Lenses

Review the product as a senior UI/UX designer would. Clean and Refined find defects against the checks below, and each check passes or fails. Showcase does not check anything. It proposes the finishing touches that make the product stand out.

Each level includes every level below it.

| Level | What you do | How you work |
|---|---|---|
| **Clean** | Find what looks wrong. | Walk the whole page on an iPhone SE and at 1440 px. Open every menu, drop-down, accordion, tab, carousel and form step, and judge only how each looks. Check the other screen sizes below for overflow and clipping. |
| **Refined** | Find what behaves wrong. | Drive every flow. |
| **Showcase** | Bring it to life. | Start from one idea the brand already owns, and make it move. |

Screen sizes, as width × height:

| Screen | Size |
|---|---|
| iPhone SE | 375 × 667 |
| iPhone 13 mini | 375 × 812 |
| iPhone 15 | 393 × 852 |
| iPhone Pro Max | 430 × 932 |
| Tablet | 768 × 1024 |
| Laptop | 1280 × 800 |
| Desktop | 1440 × 900 and 1920 × 1080 |

On a site we do not own, never submit a form, pay or send a message.

## Recommending a level

Recommend the level that would help this product most now. Take one desktop and one phone screenshot of the main screen, and spend no more than a few minutes. This quick look is not the audit: capture again in Step 3.

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

## Covering the page

1. **Survey first.** List every section, component, form and interactive element at each screen size. Save the list beside the answers file as `<target>-round-<n>-survey.md`. Run every check against it.
2. **Give every check a verdict.** Pass with its evidence, fail with each instance, or not applicable with the reason. Save the verdicts as `<target>-round-<n>-checks.md`, and summarise them in chat.
3. **Report what a visitor can see.** A failed check becomes a report section only if someone who is not a designer can see the problem in the Today picture without reading the caption. List the other failures in chat.
4. **Confirm what you measure.** A measured failure is a lead. Confirm it in a screenshot before you report it. A fluid type scale or a centred block is not a failure on its own.

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
- **C5 · Type.** No more than two font families. Each text role, such as body, label or heading, has one size at a given screen size, and the sizes form a scale of about five steps. No size is under 12 px. Body text is at least 16 px on a website and at least 14 px in a web app, with a line height between 1.4 and 1.6.
- **C6 · Colour.** Each status colour has one meaning. If the brand colour is also the error colour, offer the fix as variations, one of which keeps the brand colour. Text has at least 4.5:1 contrast, and large text at least 3:1. Status never depends on colour alone.
- **C7 · Link style.** All text links share one style, and nothing else uses it.
- **C8 · Components.** Each kind of component looks the same everywhere it appears. All buttons share one set of heights, radii and padding. The same applies to inputs, cards, chips, menus, error banners and toasts. Open menus, focus rings and selected states use the product's own colours and shapes, never a library's defaults.
- **C9 · Imagery.** The product uses one icon set with one stroke weight. Images are sharp and never stretched. Images in the same role share one aspect ratio and crop.
- **C10 · Responsive.** At each listed screen size:
  - nothing scrolls sideways, clips or overlaps;
  - stacked columns still read in the right order;
  - tables, tab rows and navigation collapse in a designed way;
  - no fixed or floating element, such as a header or a chat bubble, covers content;
  - popovers fit a phone screen or become a sheet;
  - on a wide screen, content neither stretches to full width nor sits off-centre;
  - on touch screens, navigation and main controls are at least 44 × 44 px, and links in text and lists are at least 24 px tall with space around them.
- **C11 · Long content.** Long names and Chinese text do not break the layout or get clipped.
- **C12 · Copy.** Compare the same words across every screen:
  - a label names the action, such as "Verify email" in place of "Continue";
  - the same thing has the same name everywhere, such as "Terms & Conditions" on every screen;
  - the same data is formatted the same way everywhere;
  - there are no typos and no stray punctuation.

### Website

- **CW1 · First screen.** The first screen says what the product is, who it is for, and the one next action. On an iPhone SE, 375 × 667, the headline and the call to action show without scrolling. Promo bars and the header together take no more than a quarter of the screen.
- **CW2 · Reading.** A line of body text holds 45 to 75 characters.
- **CW3 · Sections.** Each section makes one point.

### Web app

- **CA1 · Consistent frame.** The navigation, page title, page actions and primary action sit in the same place on every screen.
- **CA2 · Density.** Fixed bars leave at least two thirds of the height of a 1280 × 800 screen for the work. Rows in a list or table share one height.
- **CA3 · Tables.** Numbers are right-aligned with equal-width digits. Text is left-aligned. Each header lines up with its column.

## Experimental: Trim AI filler

Apply this check only when `trimCopy` is true in the answers file. It applies at every level and in both modes.

- **CX1 · Filler.** Every piece of text on a screen does a job: it names, labels, reports a state, or tells the user what to do at the moment they need it. Flag text that only explains the screen or praises the product:
  - a subtitle that restates its heading;
  - a sentence that describes what the page or section does, such as "Here you can manage your team";
  - helper text under a control whose label already says what it does;
  - a tagline or promise inside the screens people work in;
  - an empty state or a message that narrates, in place of saying what happened and what to do next;
  - emoji used as decoration.

  Report each kind once, with its instances side by side. Keep legal text, prices, errors, and help that a first-time user needs at that step.

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
  - A screen reader announces each error, and pressing submit moves focus to the first one.
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
- **R12 · Error messages.** Every error the user can meet, in a form or not:
  - shows beside what caused it, where the user is looking;
  - says what happened and what to do next, in plain words, without blaming the user;
  - never shows a status code, stack trace, raw library message or internal name, such as "Error 500", "Network Error" or "ECONNRESET";
  - uses one wording for the same failure everywhere, such as "This service is temporarily unavailable. Please try again in a few minutes.";
  - stays on screen until the user acts, if the user must act. A toast that fades is only for news the user can miss.

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
  - A destructive action asks for confirmation or offers Undo.
- **RA5 · Unsaved work.** Leaving a form with edits warns first. A saved change shows without a reload.
- **RA6 · Lists.** A long list can be searched, sorted and filtered, and it pages or scrolls without losing its header. Active filters show, and each one can be removed.

## Option: Failure handling

Run this section only when `failures` is true in the answers file. It adds to any level, and its checks apply in both modes unless a check says otherwise. Drive the flows it needs, even in a Clean round.

Force each failure on purpose: go offline, fail a request, let a request time out or hang, take down each embedded service and third-party script, expire the session, and pay with a test card that declines. On a site we do not own, force only the failures that need no submit.

To force a failure, use the browser's developer tools:

| Failure | How |
|---|---|
| Offline or slow network | Set network throttling to Offline or Slow 4G. |
| Backend error | Block the request, or override its response with a 500. |
| Timeout | Delay the response past the product's own timeout. |
| Hung request | Hold the response open so it never arrives. |
| Embedded service or third-party script down | Block its domain, or block its requests and its script files. |
| Service back | After a failure, unblock the request and retry without reloading the page. |
| Expired session | Delete the session cookie, then submit. |
| Declined payment | Use the payment provider's test cards in its test mode, such as Stripe's `4000 0000 0000 0002`, generic decline, `4000 0000 0000 9995`, insufficient funds, and `4000 0000 0000 0127`, wrong security code. |

- **F1 · Failed dependencies.** Apply this check to every backend, embedded service and third-party script the page depends on. Take each one down in turn, then let it hang.
  - The rest of the page still renders, navigates and works. No dependency causes a blank or white page.
  - No third-party script blocks the page from rendering.
  - Every loader and skeleton turns into content or an error within about 10 seconds.
  - A feature that fails says so where it would have appeared. It never disappears without a message.
  - A screen that fails to load shows a designed error with a way to retry. It never goes blank.
  - When one panel fails, only that panel shows the error, and the rest of the screen still works.
  - A failure never shows an empty state, such as "No data", "All 0" or "No classes available". A list or selector tells "none available" apart from "could not load".
  - A control that needs data that failed to load is disabled, and says why.
  - The failed feature offers a retry that works without reloading the page.
  - Once the service is back, the feature recovers on retry or on its own, without a new browser session or a fresh sign-in.
- **F2 · Failed submits.**
  - A submit that hangs stops waiting and says so, such as "This is taking longer than usual". The loader never spins forever.
  - Retrying a failed submit never creates a duplicate or sends the action twice.
  - In a flow with steps, a failure keeps the choices made in earlier steps, and a retry resumes at the failed step.
- **F3 · Connection, session and access.**
  - A lost connection says so and recovers without a reload. An action taken offline is either queued, and shown as waiting, or refused with a message.
  - An expired session keeps what the user typed, and returns them to the same place after sign-in.
  - Missing permission says so, and offers a way to ask for access or switch account.
  - A deleted or missing record shows a page with a route back.
  - A rate limit says when the user can try again.
  - A serious error shows a reference the user can copy, and a way to contact support.
- **F4 · Payment.** Apply this check only to a flow that takes payment.
  - A decline says why, such as a wrong security code, not enough funds, or refused by the bank.
  - After a decline, the card details stay filled in except the security code, and the page scrolls to the field to fix.
  - Other payment methods stay available after a decline.
  - Cancelling or failing a bank check or a payment redirect, such as 3-D Secure or PayPal, returns the user to checkout with the cart intact.
  - When the outcome is unknown, such as after a timeout, the page tells the user not to pay again and how they will hear the result.
  - The card is charged or refused before the user sees "Order placed".
- **F5 · Uploads.**
  - A file that is too large or of the wrong type is refused before it uploads, and the message states the limit.
  - A failed upload can be retried without choosing the file again.

## Showcase: bring it to life

Clean and Refined list the defects. Showcase adds the finishing touches that make the product stand out: animation, parallax, smooth transitions, scroll interactions and playful details. Aim high. A Showcase round changes how the product feels, not only how tidy it is.

1. **Name the concept.** Write one sentence that names the creative idea. Take it from what the brand already owns: its characters, illustration, shapes, colour or voice. Every proposal expresses that idea, so the effects belong to this product and could not be lifted from a template.
2. **Propose six to eight enhancements.** Each one is a section of the report. At least half of them move.
3. **Make two of them major changes.** Offer each as a bold variation and a restrained one.
   - On a website, one changes the first screen and one changes how the page scrolls.
   - In a web app, one changes first use or the home screen, and one changes the moment a main task is finished.

Cover at least four of these areas:

- **Entrance.** Choreograph the first screen so the headline, the image and the call to action arrive in sequence.
- **Scroll.** Reveal content as it enters view, give imagery parallax depth, pin a section and let it tell a story step by step, show progress that follows the reader, or drive a horizontal gallery from vertical scroll.
- **Transitions.** Morph pages, tabs, modals and lists into each other instead of cutting: a card grows into its detail page, an item flies into the cart, a list reorders in place.
- **Micro-interactions.** Make every control answer the hand: press, hover, toggle, drag, copy and like.
- **Playful details.** Characters that react, a cursor that does something, a hidden surprise, or a celebration when a milestone is reached.
- **Depth and texture.** Layered shadows that lift on hover, drag and open, with gradients, glass, grain or light that follows the pointer where they suit the brand.
- **Type and composition.** Display type with character, headlines that move, and layouts that break the grid on purpose.
- **Voice.** Give microcopy the brand's personality, in headlines, empty states, errors and confirmations.

Where the effects go depends on the mode:

- **Website.** Spend them on the first screen, scroll storytelling and transitions between pages. A visitor comes once, so the first impression carries most of the weight.
- **Web app.** Spend them on first use, empty states, success moments and state changes. Keep the screens people use all day calm and fast.

Give every effect a reason in the concept. Do not repeat one effect everywhere, such as the same fade-up on every section or the same scale on every hover, and keep celebrations for real milestones.

Build rules:

- **Timing.** Give the trigger, the duration in milliseconds and the easing for anything that moves. Keep interface transitions between 150 and 400 ms.
- **Reduced motion.** Give every effect a `prefers-reduced-motion` version. Under it, parallax, scroll-linked motion and anything that plays on its own stop, and content still appears, with a short fade or no motion.
- **Native scroll.** Never take over the scroll. Its speed, direction and momentum stay the browser's. Parallax moves imagery and decoration, never text the user has to read. A long scroll story has in-page links or a progress index, so scrolling is not the only way through it.
- **Performance.** Animate only `transform` and `opacity`. No effect delays the first screen, shifts the layout or makes a tap feel slow. Pause effects that are off screen.
- **Platform first.** Use CSS scroll-driven animations (`animation-timeline: scroll()` and `view()`) and the View Transition API before a library. Use GSAP and its ScrollTrigger plugin only where CSS cannot do the job.
- **Progressive enhancement.** Wrap newer features in `@supports` or a feature check. Where a browser lacks one, the page works and reads the same, without the effect. Treat transitions between separate pages as an extra, because not every browser supports them.
- **Phones.** Do not use `background-attachment: fixed`, which iOS Safari does not render. Scale parallax down on touch screens.
- **Repeated tasks.** Keep large effects off tasks that users repeat many times a day.
- **In the report.** Show motion as a strip of three frames in the after picture.
