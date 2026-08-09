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
  Scenario: B7 — a general comment is saved by Enter, and not sent
    When the reviewer starts a general comment "The whole thing reads cold"
    Then the general comment editor offers Save and the newline hint
    When the reviewer saves it with Enter
    Then the general comment editor is closed
    And the comment "The whole thing reads cold" is a draft on the review

  @browser
  Scenario: B9 — a finished round brings its summary with it
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the agent closes "Make it pop", publishes "Bigger heading" and summarises "Raised the heading to 32px and gave it more room above."
    Then the banner says the round is done and shows "Raised the heading to 32px and gave it more room above."
    When the reviewer presses the summary chevron
    Then the summary is folded away behind the chevron
    When the reviewer presses the summary chevron
    Then the summary is open

  @browser
  Scenario: B12 — the summary arrives the way it was left
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the agent closes "Make it pop", publishes "Bigger heading" and summarises "First round."
    Then the banner says the round is done and shows "First round."
    When the reviewer presses the summary chevron
    Then the summary is folded away behind the chevron
    When the reviewer opens the workspace
    And the reviewer adds a general comment "One more thing"
    And the reviewer presses Send
    And the agent takes delivery
    And the agent closes "One more thing", publishes "Second pass" and summarises "Second round."
    Then the banner carries "Second round." with it folded away

  @browser
  Scenario: B8 — the comments panel is resized and stays where it is put
    When the reviewer drags the panel edge 80px wider
    Then the comments panel is 80px wider
    When the reviewer opens the workspace
    Then the comments panel keeps its width

  @browser
  Scenario: B6 — Clear all leaves an open comment alone unless asked
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the reviewer opens Clear all
    And the reviewer confirms clearing
    Then the workspace still shows the comment "Make it pop"
    When the reviewer opens Clear all
    And the reviewer chooses to clear the open ones too
    And the reviewer confirms clearing
    Then the workspace shows no comments

  @browser
  Scenario: B11 — a question can be answered by picking an option
    When the reviewer clicks the page and writes "Sort the overdue ones first"
    And the reviewer presses Send
    And the agent takes delivery
    And the agent asks "Every overdue row, or only the ones assigned to you?" on "Sort the overdue ones first" offering "Every overdue row" and "Only mine", recommending 2
    Then the comment offers "Every overdue row" and "Only mine", with "Only mine" recommended
    When the reviewer picks "Only mine"
    Then the thread ends with "Only mine" from the reviewer

  @browser
  Scenario: B10 — Clear all takes the addressed and keeps the rest
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the agent closes "Make it pop" and publishes "Done"
    Then the workspace shows 1 comment as addressed
    And nothing is folded into Earlier
    When the reviewer adds a general comment "Still thinking about this"
    And the reviewer opens Clear all
    And the reviewer confirms clearing
    Then the workspace still shows the comment "Still thinking about this"
    And the record of "Make it pop" is closed and marked dismissed
