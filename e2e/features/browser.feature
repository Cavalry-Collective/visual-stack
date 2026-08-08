Feature: The workspace in a real browser
  Playwright drives the same workspace a reviewer uses: the pin a click drops,
  the on-canvas composer, View mode hiding the marks, Send handing the round
  over, and the confirm dialog behind Clear all.

  Background:
    Given a page is under review
    And the reviewer opens the workspace

  @browser
  Scenario: B1 — the workspace frames the page under review
    Then the tab is titled for the review of "Review e2e page"
    And the framed page shows the heading "Todo"
    And the send button is labelled for the host

  @browser
  Scenario: B2 — a click drops a pin and Enter saves the comment
    When the reviewer clicks the page and writes "Make it pop"
    Then a pin marks the comment on the canvas
    And the comment "Make it pop" is a draft on the review

  @browser
  Scenario: B3 — an empty note is discarded on dismiss
    When the reviewer clicks the page and dismisses the empty note
    Then the canvas shows no pins
    And the review has no comments on disk

  @browser
  Scenario: B4 — View mode hides every annotation
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer switches to View
    Then the canvas shows no pins

  @browser
  Scenario: B5 — Send hands the round to the agent
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    Then the comment "Make it pop" is queued, not delivered
    When the agent takes delivery
    Then the delivery names 1 open comment, 1 new

  @browser
  Scenario: B6 — Clear all sits behind a confirm
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the reviewer clears all comments from the workspace
    Then the workspace shows no comments
