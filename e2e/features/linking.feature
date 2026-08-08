Feature: The stream watcher links a session
  How a real agent session stays wired: it arms `watch --all --stream`, answers
  the HANDSHAKE with `ack`, and from then on rounds arrive as REVIEW events
  while its heartbeat proves to the server that someone is listening.

  @round1
  Scenario: S17 — the stream watcher handshakes, links, and receives the round
    Given a page is under review
    When the agent arms the stream watcher
    Then the watcher asks for a handshake
    When the agent answers the handshake
    Then the watcher reports LINKED
    And the agent's presence is heartbeated
    When the reviewer sends a comment "A"
    Then the watcher receives a REVIEW event
    And the workspace cannot requeue the round while the watcher lives
