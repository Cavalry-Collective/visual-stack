Feature: Page review — clearing
  Three distinct acts: Clear all takes every comment off the list, Clear
  history removes past versions and keeps the present, and a hard reset
  restarts the review at v1 without undoing the agent's edits.

  Background:
    Given a page is under review

  @round1
  Scenario: S7 — Clear all empties the list without touching versions
    Given the reviewer has sent a comment "C"
    And the agent has taken delivery
    And the agent closes "C" and publishes "C done"
    And the reviewer has sent a comment "A"
    And the agent has taken delivery
    And the reviewer has sent a comment "B"
    When the reviewer clears all comments
    Then the workspace shows no comments
    And no record remains of "B"
    And the record of "A" is closed and marked dismissed
    And the version history is untouched
    And the agent can still close "A"

  @round1
  Scenario: S8 — Clear history deletes past versions and keeps the present
    Given the review has reached version 3
    And the reviewer has sent a comment "A"
    When the reviewer clears the history
    Then only version 3 remains on the timeline
    And the review is still at version 3
    And the comment "A" is still on the review

  @round1
  Scenario: S9 — a hard reset restarts the review at v1
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    And the agent edits the page
    And the agent closes "A" and publishes "Edited"
    When the reviewer hard-resets the review
    Then the review starts again at version 1
    And the workspace shows no comments
    And the page keeps the agent's edits
