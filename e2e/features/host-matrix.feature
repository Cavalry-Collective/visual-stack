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
