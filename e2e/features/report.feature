Feature: A design review report answered in its own tab
  The report opens as its own page, served over the JSON bridge. The reviewer
  answers each section, sends, and sees when a steered section is revised.

  Background:
    Given a design review report is served on its own
    And the reviewer opens the report

  @browser
  Scenario: R1 — answers reach the answers file
    When the reviewer approves the section "f-example"
    And the reviewer steers the section "f-slider" with "Make the handle bigger"
    And the reviewer sends the answers
    Then the answers file approves "f-example"
    And the answers file steers "f-slider" with "Make the handle bigger"

  @browser
  Scenario: R2 — a revised section asks for a fresh answer
    When the reviewer steers the section "f-slider" with "Make the handle bigger"
    And the reviewer sends the answers
    And the agent revises the section "f-slider"
    And the reviewer shows the revision
    Then the section "f-slider" shows the revision, quoting "Make the handle bigger"

  @browser
  Scenario: R3 — Approve & finish sends and closes the link
    When the reviewer approves the section "f-example"
    And the reviewer presses Approve & finish twice
    Then the answers file approves "f-example"
    And the report server has closed
