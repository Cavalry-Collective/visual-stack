Feature: Host matrix — Claude and Codex
  The protocol is host-independent; the host selects a profile that the server
  stamps into the workspace. CI runs the whole suite under VSTACK_HOST=claude
  and VSTACK_HOST=codex; these scenarios pin the differences that remain.

  @round1
  Scenario Outline: the workspace is stamped with the host profile
    Given a page is under review with host "<host>"
    Then the workspace injects the "<host>" profile named "<name>"
    And the injected share capability is "<share>"

    Examples:
      | host   | name   | share    |
      | claude | Claude | artifact |
      | codex  | Codex  | copy     |

  @browser
  Scenario Outline: the hand-out control follows the host's subagent capability
    Given a page is under review with host "<host>"
    And the reviewer opens the workspace
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the reviewer adds a general comment "Give the list more air"
    And the reviewer presses Send
    Then the hand-out control on "Give the list more air" is <shown>
    And the hand-out control on "Make it pop" is hidden

    Examples:
      | host   | shown  |
      | claude | shown  |
      | codex  | hidden |

  @browser
  Scenario: a comment handed out is worked on beside the round in flight
    Given a page is under review with host "claude"
    And the reviewer opens the workspace
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the reviewer adds a general comment "Give the list more air"
    And the reviewer presses Send
    And the reviewer hands "Give the list more air" out to a subagent
    Then the comment "Give the list more air" is handed out and still queued
    When the agent takes the delegated delivery
    Then the delegated brief for "Give the list more air" scopes it to that comment alone
    And the comment "Make it pop" still holds the active slot
    And the workspace shows "Give the list more air" as work in flight

  @browser
  Scenario Outline: the Parallel mode setting follows the host's subagent capability
    Given a page is under review with host "<host>"
    And the reviewer opens the workspace
    Then the Parallel mode setting is <shown>

    Examples:
      | host   | shown  |
      | claude | shown  |
      | codex  | hidden |

  @browser
  Scenario: with every comment handed out, one send arrives as one batch
    Given a page is under review with host "claude"
    And the reviewer opens the workspace
    When the reviewer turns on Parallel mode
    And the reviewer adds a general comment "Give the list more air"
    And the reviewer adds a general comment "Tighten the footer"
    And the reviewer presses Send
    Then the comment "Give the list more air" is handed out and still queued
    And the comment "Tighten the footer" is handed out and still queued
    When the agent takes the delegated delivery
    Then the delegated delivery names "Give the list more air" and "Tighten the footer"

  @browser
  Scenario: turning on Parallel mode hands out what is already queued
    Given a page is under review with host "claude"
    And the reviewer opens the workspace
    When the reviewer clicks the page and writes "Make it pop"
    And the reviewer presses Send
    And the agent takes delivery
    And the reviewer adds a general comment "Give the list more air"
    And the reviewer presses Send
    And the reviewer turns on Parallel mode
    Then the server records "Give the list more air" as handed out
    And the comment "Make it pop" still holds the active slot
    When the agent takes the delegated delivery
    Then the delegated brief for "Give the list more air" scopes it to that comment alone
