Feature: Live app review
  The same loop pointed at a running app. Comments carry the route they were
  made on, a publish is a marker rather than a file snapshot, and nothing the
  review does touches the app.

  Background:
    Given an app is running and under live review

  @round1
  Scenario: S10 — a live comment carries the route it was made on
    When the reviewer sends a comment "Tighten this" on route "/settings"
    And the agent takes delivery
    Then the delivery names 1 open comment, 1 new
    And the brief names the route "/settings" on "Tighten this"

  @round1
  Scenario: S11 — a live publish is a marker, not a file snapshot
    Given the reviewer has sent a comment "A" on route "/"
    And the agent has taken delivery
    When the agent closes "A" and publishes "Fixed spacing"
    Then the comment "A" is closed
    And no version file was frozen

  @browser
  Scenario: S17 — a live round announces itself through its summary
    Given the reviewer has sent a comment "A" on route "/"
    And the agent has taken delivery
    And the reviewer opens the workspace
    When the agent closes "A", publishes "Fixed spacing" and summarises "Tightened the header spacing in Header.tsx."
    Then the banner says the round is done and shows "Tightened the header spacing in Header.tsx."

  @round1
  Scenario: S12 — a hard reset in a live review deletes comments only
    Given the reviewer has sent a comment "A" on route "/"
    And the agent has taken delivery
    When the reviewer hard-resets the review
    Then the workspace shows no comments
    And the app is untouched
