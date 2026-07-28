# @vue-ecosystem/tour

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Guided product tours and onboarding walkthroughs for Vue 3.

- **Dependency layer:** 3 — `core` + `state-machine`
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: step definitions, highlight and positioning
- [ ] Tour progression driven by `state-machine`
- [ ] Persistence of "already seen" state
- [ ] RTL-aware placement
- [ ] a11y: focus trap, `aria-describedby` wiring, Escape to exit

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
