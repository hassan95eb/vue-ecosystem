---
'@vue-ecosystem/realtime': minor
---

Shipped the package's MVP: `useWebSocket()`, a reactive WebSocket connection with
full-jitter exponential-backoff auto-reconnect. Exposes `status`, `data`, `error`
and `reconnectAttempt`, plus `send()` / `open()` / `close()`. The backoff
calculator (`computeReconnectDelay`) is exported separately for anyone rolling
their own transport. The socket constructor is injectable via `createWebSocket`
for testing or non-browser runtimes.

The package moves from a private skeleton to a real, publishable `0.1.0`. Its
remaining planned scope (SSE, presence channels, optimistic updates, offline
queue) is tracked in the package README and not part of this pass.
