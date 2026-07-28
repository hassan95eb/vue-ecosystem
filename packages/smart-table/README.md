# @vue-ecosystem/smart-table

> **Status: skeleton.** Not implemented, not published. This directory exists so the
> dependency graph, versioning and CI are already correct when work starts.

Data table for Vue 3: sorting, filtering, pagination, virtualised rows.

- **Dependency layer:** 3 — `core` + `virtual-scroll` + `query-builder`, with `persian-tools` as an optional peer
- **Build tool when implemented:** see the table in [ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision)
- **Initial version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## TODO

- [ ] MVP: headless table core (columns, sorting, selection)
- [ ] Styled SFC shell — the first package built with Vite library mode
- [ ] Virtualised rows via `virtual-scroll`
- [ ] Filter UI backed by `query-builder`
- [ ] Optional Jalali/Persian column formatters via `persian-tools`
- [ ] a11y: full keyboard grid navigation, correct ARIA grid roles

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
