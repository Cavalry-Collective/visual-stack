Feature: Long pages and overlays on the canvas
  A page taller than the canvas is scrolled two different ways — the canvas
  scrolls it when the frame grew to the whole document, the page scrolls itself
  when it did not — and a comment has to land on what was under the pointer in
  both. An overlay the page opens has to appear where the reviewer is looking,
  not screens below it.

  @browser
  Scenario: F1 — a comment lands on what was clicked after the canvas scrolls
    Given a long page is under review
    And the reviewer opens the workspace
    When the reviewer scrolls the canvas to the bottom
    And the reviewer clicks "#tail" in the framed page and writes "Down here"
    Then a pin marks the comment on the canvas
    And the comment "Down here" is anchored to "tail"

  @browser
  Scenario: F2 — a comment lands on what was clicked after the page scrolls itself
    Given a page that keeps its own scrollbar is under review
    And the reviewer opens the workspace
    When the reviewer scrolls the framed page to the bottom
    And the reviewer clicks "#tail" in the framed page and writes "Still here"
    Then a pin marks the comment on the canvas
    And the comment "Still here" is anchored to "tail"

  @browser
  Scenario: F3 — a dialog the page opens lands on screen, and the fit comes back
    Given a long page is under review
    And the reviewer opens the workspace
    When the reviewer switches to View
    And the framed page opens its confirmation dialog
    Then the dialog is where the reviewer is looking
    When the framed page closes its confirmation dialog
    Then the canvas fits the whole page again
