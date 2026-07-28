# @vue-ecosystem/query-builder

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Composable, type-safe filter and query builder with a serialisable AST.

- **Dependency layer:** 2 — depends on `core` only
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: engine — typed AST, builder API, serialise/deserialise
- [ ] Adapters: REST query string, and a generic SQL-ish emitter
- [ ] `useQueryBuilder()` composable
- [ ] Validation errors as `EcosystemError` subclasses
- [ ] Property tests: every AST survives a serialise → parse round trip

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
