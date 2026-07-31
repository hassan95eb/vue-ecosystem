# @vue-ecosystem/realtime

> **Status: feature-complete for MVP.** `useWebSocket`, `useEventSource`,
> `useOptimistic` and `useChannel` are all implemented and tested. See
> [Roadmap](#roadmap) for what's deliberately still out of scope.

Composables for realtime data: WebSocket/SSE connection lifecycle, reconnection and optimistic state.

- **Dependency layer:** 2 — depends on `core` only
- **Build tool:** tsup (logic-only package, no `.vue` SFCs) — see the table in
  [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Current version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## Install

```bash
pnpm add @vue-ecosystem/realtime
```

## `useWebSocket`

Reactive WebSocket connection with exponential-backoff auto-reconnect.

```vue
<script setup lang="ts">
import { useWebSocket } from '@vue-ecosystem/realtime'

const { status, data, send, close } = useWebSocket('wss://example.com/socket')
</script>

<template>
  <p>{{ status }}</p>
  <button :disabled="status !== 'open'" @click="send('ping')">Send</button>
</template>
```

- **`status`** — `'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting'`.
  `'reconnecting'` covers the whole retry cycle, from the moment a drop is
  detected through the next connection attempt.
- **`data`** — payload of the most recently received message.
- **`error`** — an `EcosystemError` (code `realtime/socket-error` or
  `realtime/socket-construct-error`) if a socket-level error has fired; cleared
  on the next successful open.
- **`reconnectAttempt`** — `0` while idle, connecting or open; the 1-based
  count of consecutive reconnect attempts otherwise.
- **`queueLength`** — number of messages currently buffered by the offline
  queue (see below); `0` unless `queueWhenOffline` is enabled.
- **`send(data)`** — returns `false` (never throws) instead of sending if the
  socket isn't open. With `queueWhenOffline` enabled the message is buffered
  instead of dropped; the return value still reflects "sent right now", not
  "accepted for later" -- watch `queueLength` for that.
- **`open()`** / **`close(code?, reason?)`** — connect manually / close
  (cancelling any pending auto-reconnect and clearing the offline queue).

Reconnection uses full-jitter exponential backoff (`computeReconnectDelay`,
also exported for anyone rolling their own transport) so that many clients
reconnecting after the same outage don't all hit the server in the same
instant. Tune it, or the retry ceiling, through options:

```ts
useWebSocket(url, {
  backoff: { baseDelayMs: 300, maxDelayMs: 10_000, multiplier: 2, jitter: 0.5 }, // defaults shown
  autoReconnect: { maxAttempts: 5 }, // or `false` to disable entirely
})
```

For tests or non-browser runtimes, `createWebSocket` swaps out the socket
constructor:

```ts
useWebSocket(url, { createWebSocket: (url, protocols) => myWebSocketLike(url, protocols) })
```

### Offline queue and message ordering

Opt in with `queueWhenOffline` to buffer `send()` calls made while the socket
isn't open, and flush them in the same order once it opens -- including after
an automatic reconnect:

```ts
const { send, queueLength } = useWebSocket(url, {
  queueWhenOffline: true, // or `{ maxQueueSize: 500 }`, default cap is 100
})
```

Past `maxQueueSize` the oldest buffered message is dropped to make room for
the newest, with a warning logged. A manual `close()` clears anything still
queued -- closing is treated as "stop trying," not "hold onto this for later."

## `useEventSource`

Reactive Server-Sent Events connection. Same shape as `useWebSocket`
(`status`, `data`, `error`, `reconnectAttempt`, `open()`, `close()`) minus
`send`/`queueLength`, since SSE is server-to-client only.

```ts
import { useEventSource } from '@vue-ecosystem/realtime'

const { status, data } = useEventSource('/api/stream')
```

Named SSE events (`event: priceUpdate` in the wire format) are subscribed
via `events`, separately from `data` (which only ever reflects the default
`message` event):

```ts
useEventSource('/api/stream', {
  events: { priceUpdate: (event) => console.log(event.data) },
})
```

**Reconnection is fully taken over from the native `EventSource`.** Browsers
retry SSE connections on their own, but with no control over timing and no
attempt count -- this composable closes the underlying `EventSource` on every
`error` event and reconnects itself through the same backoff engine
`useWebSocket` uses, so the two composables behave identically and expose the
same `reconnectAttempt`. `backoff`, `autoReconnect` and `createEventSource`
work exactly like their `useWebSocket` counterparts.

## `useOptimistic`

Framework-level optimistic-update state, independent of any transport --
useful with `useWebSocket`/`useEventSource`/`useChannel` or plain HTTP calls.

```ts
import { useOptimistic } from '@vue-ecosystem/realtime'

const { value, isPending, error, commit } = useOptimistic(todo)

async function toggle() {
  await commit({ ...todo.value, done: !todo.value.done }, () => api.updateTodo(todo.value))
}
```

`commit(optimisticValue, mutate)` applies `optimisticValue` immediately, then
runs `mutate`. On success `value` becomes whatever `mutate` resolved to (or
stays `optimisticValue` if `mutate` resolves `undefined`). On failure `value`
rolls back to the last confirmed value, `error` is set, and `onError(error,
rolledBackTo)` fires.

**Concurrent commits never let an older one clobber a newer one.** If a
second `commit()` starts before the first settles, the first commit's
eventual failure rolls back only if it's still the most recent call --
otherwise the second commit's optimistic value (or its own later result)
is left alone. `isPending` counts in-flight commits, not just the latest.

## `useChannel`

Multiplexes a named pub/sub + presence channel over a single connection
(typically `useWebSocket`), using this package's own JSON envelope protocol.
**This is this package's own convention, not a standard -- your server has to
speak it:**

- client → server: `{ type: 'subscribe' | 'unsubscribe' | 'publish', channel, payload? }`
- server → client: `{ type: 'message' | 'presence' | 'error', channel, payload? }`
  - `message` payload — whatever was published
  - `presence` payload — `{ members: string[] }`, the full roster
  - `error` payload — `{ message: string }`

```ts
import { useWebSocket, useChannel } from '@vue-ecosystem/realtime'

const socket = useWebSocket('wss://example.com/socket')
const room = useChannel(socket, 'room:42')

watch(room.lastMessage, (payload) => console.log(payload))
room.publish({ text: 'hi' })
```

- Multiple `useChannel` calls can share one connection; each only reacts to
  envelopes addressed to its own `channel` name.
- Automatically (re-)subscribes whenever the connection's `status` becomes
  `'open'` -- including after a reconnect, since the server won't remember a
  subscription across a dropped connection -- and sends `unsubscribe` on
  disposal if still connected.
- `subscribed` is best-effort: the MVP protocol has no subscribe
  acknowledgement, so it reflects "we sent a subscribe envelope while open,"
  not a confirmed server-side join.
- `useChannel` depends only on a minimal `ChannelTransport` shape (`status`,
  `data`, `send`), not on `useWebSocket` specifically -- `UseWebSocketReturn`
  satisfies it structurally, and tests can pass a lightweight mock instead of
  a whole fake socket.

**Known limitation:** because `useChannel` reads through the connection's
single `data` ref, two envelopes with byte-for-byte identical JSON arriving
back to back won't both trigger reactivity (Vue skips a ref update that's
value-equal to the current one). Harmless for `message`/`error` envelopes in
practice; a `presence` re-broadcast with an unchanged member list is the
realistic case where this could matter.

Minimal reference server sketch (Node, `ws`):

```ts
const subscribers = new Map<string, Set<WebSocket>>() // channel -> sockets

function subscribersFor(channel: string): Set<WebSocket> {
  let set = subscribers.get(channel)
  if (!set) {
    set = new Set()
    subscribers.set(channel, set)
  }
  return set
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const { type, channel, payload } = JSON.parse(raw.toString())
    if (type === 'subscribe') {
      subscribersFor(channel).add(socket)
    } else if (type === 'unsubscribe') {
      subscribers.get(channel)?.delete(socket)
    } else if (type === 'publish') {
      for (const s of subscribers.get(channel) ?? []) {
        s.send(JSON.stringify({ type: 'message', channel, payload }))
      }
    }
  })
})
```

## Roadmap

- [x] MVP: `useWebSocket()` with exponential-backoff reconnection
- [x] SSE support (`useEventSource`)
- [x] Presence and subscription channels (`useChannel`)
- [x] Optimistic updates with rollback (`useOptimistic`)
- [x] Offline queue and message-order guarantees (`useWebSocket`'s `queueWhenOffline`)
- [ ] Transport abstraction (WebSocket, SSE, custom) -- **deliberately not
      done.** `useWebSocket` and `useEventSource` are two independent,
      concrete implementations that duplicate their reconnect-loop shape
      (both reuse the pure `computeReconnectDelay`, nothing more). Abstracting
      the shared shape into one engine is real future work, but doing it
      _before_ a second concrete transport existed would have been guessing
      at the abstraction instead of deriving it -- this is that deliberate
      later pass.
- [ ] Highest product priority in the roadmap — see ARCHITECTURE.md

## Contributing

Please open an issue before starting work on the roadmap items above — the
scope for each pass is decided deliberately, not first-come. See
[CONTRIBUTING.md](../../CONTRIBUTING.md).
