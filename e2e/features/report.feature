Feature: A design review report answered in its own tab
  The review opens as its own page, served over the JSON bridge. The reviewer
  picks a level, watches the audit, then answers each section of the report,
  sends, and sees when a steered section is revised.

  Rule: The reviewer starts the review in the page

  Background:
    Given a design review is started on its own
    And the reviewer opens the review

  @browser
  Scenario: R0 — a level picked in 中文 becomes a report in the same tab
    When the reviewer switches the review to 中文
    Then the level panels read in 中文
    When the agent recommends the level "refined"
    Then the panel "refined" shows as recommended
    When the reviewer chooses Report only
    And the reviewer picks the level "refined"
    Then the answers file holds the level "refined" in "zh"
    And the answers file asks for a report
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

  Rule: The reviewer answers the report

  Background:
    Given a design review report is served on its own
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
    When the reviewer presses Approve & finish twice
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
    And the reviewer approves the section "f-variants"
    And the reviewer sends the answers
    Then the answers file approves "f-variants" with the variation "Band"

  @browser
  Scenario: R6 — the reviewer asks for more variations
    When the reviewer asks for more variations of "f-example" exploring "Try a denser list"
    And the reviewer sends the answers
    Then the answers file asks for more variations of "f-example" exploring "Try a denser list"

  Rule: A review can find nothing to change

  @browser
  Scenario: R7 — a report with no sections says so
    Given a design review report with no sections is served
    When the reviewer opens the empty report
    Then the report says there is nothing to change

  Rule: A report-only review hands over a report

  @browser
  Scenario: R8 — the handoff report shows every approved section, with nothing to answer
    Given a design report handoff is served
    When the reviewer opens the handoff report
    Then every section shows at once, with nothing to answer
