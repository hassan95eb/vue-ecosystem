---
'@vue-ecosystem/realtime': minor
---

Closed out the rest of the package's MVP scope:

- `useEventSource()`: reactive Server-Sent Events connection. Same
  `status`/`data`/`error`/`reconnectAttempt`/`open()`/`close()` shape as
  `useWebSocket`, named-event subscriptions via `events`, and reconnection
  fully taken over from the native `EventSource` (closed and recreated
  through the same backoff engine, rather than relying on the browser's
  uncontrollable built-in retry).
- `useOptimistic()`: transport-independent optimistic-update state with
  `commit(optimisticValue, mutate)`, rollback to the last confirmed value on
  failure, and generation-tracked commits so an older commit's failure can
  never clobber a newer commit's still-in-flight optimistic value.
- `useChannel()`: multiplexes named pub/sub + presence channels over a
  single connection using this package's own JSON envelope protocol
  (documented in the README, including a minimal reference server).
  Auto-(re)subscribes on open/reconnect, auto-unsubscribes on disposal,
  tracks a presence roster, and surfaces server-sent channel errors.
- `useWebSocket()`: new opt-in `queueWhenOffline` option buffers `send()`
  calls made while not connected and flushes them in order on the next open
  (bounded by `maxQueueSize`, drop-oldest on overflow), plus a new
  `queueLength` return value. Manual `close()` now also clears the queue.

The "transport abstraction" item from the package's roadmap is deliberately
still not done -- `useWebSocket` and `useEventSource` remain two independent
implementations sharing only the pure `computeReconnectDelay` calculator, and
abstracting the shared shape before a second concrete transport existed would
have been guessing at the abstraction rather than deriving it from real
duplication. See the package README's Roadmap section.
