Feature: Edge cases
  The liveness rules: nothing the reviewer does can stop the agent finishing,
  a stranded round can be requeued only once nothing is listening, approval
  ends the review deliberately, and a retried close is safe.

  Background:
    Given a page is under review

  @round1
  Scenario: S13 — withdrawing a delivered comment never blocks the agent
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    When the reviewer withdraws "A"
    Then the workspace shows no comments
    And the record of "A" is closed and marked dismissed
    And the agent can still close "A"

  @round1
  Scenario: S14a — requeue is refused while the agent is listening
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    And the agent's watching heartbeat is fresh
    When the workspace asks to requeue
    Then the server refuses the requeue
    And the comment "A" has been sent and delivered

  @round1
  Scenario: S14b — requeue rescues a dead session's round
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    And nothing is listening
    When the workspace asks to requeue
    Then the comment "A" is queued, not delivered
    When the agent takes delivery
    Then the delivery names 1 open comment, 1 new

  @round1
  Scenario: S15 — approve ends the review deliberately
    Given the reviewer has sent comments "A" and "B"
    And the agent has taken delivery
    When the reviewer approves the design expecting 2 open comments
    Then the approval records 2 open comments
    And the server exits on its own

  @round1
  Scenario: S16 — closing twice is a no-op
    Given the reviewer has sent a comment "A"
    And the agent has taken delivery
    And the agent closes "A" and publishes "Done"
    When the agent closes "A" again
    Then the command succeeds
    And the review is still at version 2
