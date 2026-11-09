Feature: A design review report in the workspace
  The report carries controls of its own. The reviewer answers a section with
  one press and sends the answers as a single comment, and the workspace lets
  those presses reach the page while the reviewer is annotating.

  Background:
    Given a design review report is under review
    And the reviewer opens the workspace

  @browser
  Scenario: R1 — a control on the page answers a finding in Annotate mode
    When the reviewer presses Approve on the section "f-example" without leaving Annotate mode
    And the reviewer presses Send decisions on the page
    Then the review holds a comment that says "Approved: f-example"

  @browser
  Scenario: R2 — approving from the page closes the review
    When the reviewer presses Approve & finish on the page twice
    Then the workspace shows its closing screen
    And the review is closed
