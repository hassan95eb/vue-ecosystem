# @vue-ecosystem/form-builder

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Schema-driven form rendering and validation for Vue 3.

- **Dependency layer:** 3 — `core` + `state-machine`, with `persian-tools` as an optional peer
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: schema → fields, with typed values
- [ ] Validation pipeline and async validators
- [ ] Multi-step flows driven by `state-machine`
- [ ] Optional Iranian validators via `persian-tools`
- [ ] a11y: label/description/error wiring, focus management on submit

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
