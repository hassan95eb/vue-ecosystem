# @vue-ecosystem/state-machine

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Typed, declarative finite state machines for Vue 3 components and flows.

- **Dependency layer:** 1 — depends on `core` only
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: `defineMachine()` with typed states, events and guards
- [ ] `useMachine()` composable with a reactive current state
- [ ] Entry/exit actions and async transitions
- [ ] Devtools-friendly transition log via `createLogger`
- [ ] Unit tests covering guard rejection and unreachable-state detection

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
