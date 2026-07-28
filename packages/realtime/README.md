# @vue-ecosystem/realtime

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Composables for realtime data: WebSocket/SSE connection lifecycle, reconnection and optimistic state.

- **Dependency layer:** 2 — depends on `core` only
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: `useWebSocket()` with exponential-backoff reconnection
- [ ] Transport abstraction (WebSocket, SSE, custom)
- [ ] Presence and subscription channels
- [ ] Optimistic updates with rollback
- [ ] Offline queue and message-order guarantees
- [ ] Highest product priority in the roadmap — see ARCHITECTURE.md

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
