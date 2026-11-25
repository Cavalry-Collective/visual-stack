Feature: A Polish report answered in its own tab
  The review opens as its own page, served over the JSON bridge. The reviewer
  picks a level, watches the audit, then answers each section of the report,
  sends, and sees when a steered section is revised.

  Rule: The reviewer starts the review in the page

  Background:
    Given a Polish review is started on its own
    And the reviewer opens the review

  @browser
  Scenario: R0 — a level picked in 中文 becomes a report in the same tab
    When the reviewer switches the review to 中文
    Then the level panels read in 中文
    When the agent recommends the level "refined"
    Then the panel "refined" shows as recommended
    When the reviewer chooses Report only
    And the reviewer sets the effort to "high" and turns on Proofread
    Then the effort hint names the model for "high"
    And Done folds the options into one line under the panels, on a phone as well
    When the reviewer picks the level "refined"
    Then the answers file holds the level "refined" in "zh"
    And the answers file asks for a report
    And the answers file runs at "high" effort, with only Proofread on
    When the agent lists 3 tasks and ticks the first
    Then the review shows 1 of 3 tasks done
    When the agent stops with a problem
    And the reviewer presses Retry
    Then the answers file asks the agent to retry
    When the agent publishes the report
    Then the same tab shows the report in 中文
    When the reviewer approves the section "f-example"
    And the reviewer sends the answers
    Then the answers file approves "f-example"
    And the answers file still holds the level "refined"

  @browser
  Scenario: R0b — an in-depth review picks its screens on a site map
    When the reviewer turns on In depth and picks the level "clean"
    Then the answers file asks for an in-depth review
    When the agent publishes a site map of a page with a modal and a panel
    Then the same tab shows the site map with all 3 screens ticked
    When the reviewer closes the page "s-home" in the map
    Then the map hides what opens on "s-home"
    When the reviewer unticks "s-cart" and sets the depth to "deep"
    And the reviewer starts the review
    Then the answers file focuses on "s-home,s-signin" at "deep" depth
    When the agent marks "s-home" done with 3 findings
    Then the map shows 1 of 2 screens done
    When the agent publishes the report
    Then the same tab shows the report

  Rule: The reviewer answers the report

  Background:
    Given a Polish report is served on its own
    And the reviewer opens the report

  @browser
  Scenario: R1 — the reviewer answers one section at a time
    When the reviewer approves the section "f-example"
    Then the report shows the section "f-variants"
    And the answers file approves "f-example"
    When the reviewer opens a picture full size and goes back
    Then the picture closes and the report stays open
    When the reviewer presses the right arrow key
    Then the report shows the section "f-slider"
    When the reviewer steers the section "f-slider" with "Make the handle bigger"
    And the reviewer sends the answers
    Then the answers file approves "f-example"
    And the answers file steers "f-slider" with "Make the handle bigger"
    When on a phone the reviewer picks "f-example" from the findings drawer
    Then the drawer closes on the section "f-example"

  @browser
  Scenario: R2 — a revised section asks for a fresh answer
    When the reviewer steers the section "f-slider" with "Make the handle bigger"
    And the reviewer sends the answers
    And the agent revises the section "f-slider"
    Then the page announces the revision of "f-slider"
    When the reviewer shows the revision
    Then the section "f-slider" shows the revision, quoting "Make the handle bigger"

  @browser
  Scenario: R3 — Approve & finish sends and closes the link
    When the reviewer approves the section "f-example"
    And the reviewer opens the ▾ menu and presses Esc
    Then the ▾ menu is closed
    When the reviewer presses Approve & finish twice on the last slide
    Then the answers file approves "f-example"
    And the report server has closed
    And the page shows the review filed with 1 approved

  @browser
  Scenario: R4 — a sent steer closes its box
    When the reviewer steers the section "f-slider" without a note
    And the reviewer sends the answers
    Then the report asks for a note on "f-slider"
    When the reviewer adds the note "Make the handle bigger" to "f-slider"
    And the reviewer sends the answers
    Then the steer box on "f-slider" is closed, quoting "Make the handle bigger"
    And the pictures of "f-slider" wait behind a blur
    When the reviewer approves the section "f-slider"
    Then steering "f-slider" again starts with an empty note

  @browser
  Scenario: R5 — approving a section with variations records the one on show
    When the reviewer shows the variation "Band" of "f-variants"
    Then Approve on "f-variants" says only Approve
    When the reviewer approves the section "f-variants"
    And the reviewer sends the answers
    Then the answers file approves "f-variants" with the variation "Band"

  @browser
  Scenario: R6 — one press asks for more variations
    Then the bar offers Approve and Reject, with Steer as a link
    When the reviewer asks for more variations of "f-example"
    Then the page confirms the request for more variations
    And the report shows the section "f-variants"
    And the answers file asks for more variations of "f-example"

  @browser
  Scenario: R10 — a bounded wait hears each send and says how to wait again
    When the agent waits 1 second for an answer
    Then the wait ends IDLE with a command that resumes from seq 0
    When the reviewer approves the section "f-example"
    And the agent runs the wait command it was given
    Then the wait reports the send, with a command that resumes from it

  Rule: A review can find nothing to change

  @browser
  Scenario: R7 — a report with no sections says so
    Given a Polish report with no sections is served
    When the reviewer opens the empty report
    Then the report says there is nothing to change

  Rule: A report-only review hands over a report

  @browser
  Scenario: R8 — the handoff report shows every approved section, with nothing to answer
    Given a design report handoff is served
    When the reviewer opens the handoff report
    Then every section shows at once, with nothing to answer

  Rule: A report opened without a server copies a brief for another agent

  @browser
  Scenario: R9 — Copy decisions carries everything another agent needs
    Given a Polish report is opened off disk
    When the reviewer approves the section "f-example"
    And the reviewer steers the section "f-slider" with "Make the handle bigger"
    And the reviewer sends the answers
    Then the copied brief carries the context, the reason and the spec of "f-example"
    And the copied brief steers "f-slider" with "Make the handle bigger" and leaves "f-variants" unanswered
