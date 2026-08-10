Feature: Page review — sending comments
  A sent comment reaches the agent immediately when nothing is active. Every
  delivery contains one comment, and ready comments are handled FIFO.

  Background:
    Given a page is under review

  @round1
  Scenario: S1 — send with no round in flight is delivered immediately
    When the reviewer sends a comment "Make the title bigger"
    And the agent takes delivery
    Then the delivery names 1 open comment, 1 new
    And the brief lists "Make the title bigger" as new
    And the comment "Make the title bigger" has been sent and delivered

  @round1
  Scenario: S2 — a comment sent mid-round is queued and picked up after the round
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    When the reviewer sends a comment "B"
    Then the comment "B" is queued, not delivered
    When the agent closes "A" and publishes "Round one done"
    And the agent takes delivery
    Then the delivery names 1 open comment, 1 new
    And the brief lists "B" as new

  @round1
  Scenario: S3 — ready comments are delivered FIFO, one at a time
    Given the reviewer has sent comments "A" and "B"
    And the agent has taken delivery
    When the agent closes "A" and publishes "Only A"
    And the reviewer sends a comment "C"
    And the agent takes delivery
    Then the delivery names 1 open comment, 1 new
    And the brief lists "B" as new
    When the agent closes "B" and publishes "Then B"
    And the agent takes delivery
    Then the delivery names 1 open comment, 1 new
    And the brief lists "C" as new
