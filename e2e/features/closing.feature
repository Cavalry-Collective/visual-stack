Feature: Page review — closing, versions, threads
  Only the agent closes a comment. A publish freezes the page as the next
  version; a reply keeps the conversation going without changing state, and a
  reviewer reply to a closed comment reopens it.

  Background:
    Given a page is under review

  @round1
  Scenario: S4 — publish closes the comment and freezes the next version
    Given the reviewer has sent a comment "Make the title bigger"
    And the agent has taken delivery
    When the agent edits the page
    And the agent closes "Make the title bigger" and publishes "Bigger title"
    Then the review is at version 2
    And version 2 is a frozen copy of the page labelled "Bigger title"
    And the comment "Make the title bigger" is closed

  @round1
  Scenario: S5 — an agent reply asks a question and keeps the comment open
    Given the reviewer has sent a comment "Sort the list"
    And the agent has taken delivery
    When the agent replies "By date, or by name?" to "Sort the list"
    Then the thread on "Sort the list" has an agent reply "By date, or by name?"
    And the comment "Sort the list" is open
    And nothing is left unanswered

  @round1
  Scenario: S6 — a reviewer reply to a closed comment reopens it
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    And the agent closes "A" and publishes "Done"
    When the reviewer replies "Not quite — bolder too" to "A"
    Then the comment "A" is open
    When the agent takes delivery
    Then the brief carries the reply "Not quite — bolder too"
