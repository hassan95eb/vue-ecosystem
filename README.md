# vue-ecosystem

A set of composable, independently versioned Vue 3 libraries that are built to work
together — not nine unrelated packages that happen to share a repo.

Everything is TypeScript-first (strict), ships ESM + CJS + `.d.ts`, keeps Vue as a
peer dependency, and is MIT licensed.

> The npm scope is currently the placeholder `@vue-ecosystem`. It will be replaced
> with the final organisation name in a single pass before the first publish.

## Packages

| Package                                                        | Status     | What it does                                                                        |
| -------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| [`@vue-ecosystem/core`](packages/core)                         | ✅ ready   | Base error type, namespaced debug logger, shared composable types                   |
| [`@vue-ecosystem/persian-tools`](packages/persian-tools)       | ✅ ready   | Jalali dates, Persian number/currency formatting, Iranian validators, `v-rtl-input` |
| [`@vue-ecosystem/realtime`](packages/realtime)                 | 🚧 planned | WebSocket/SSE lifecycle, reconnection, optimistic state                             |
| [`@vue-ecosystem/smart-table`](packages/smart-table)           | 🚧 planned | Data table: sorting, filtering, pagination, virtualised rows                        |
| [`@vue-ecosystem/state-machine`](packages/state-machine)       | 🚧 planned | Typed, declarative finite state machines                                            |
| [`@vue-ecosystem/query-builder`](packages/query-builder)       | 🚧 planned | Type-safe filter/query builder with a serialisable AST                              |
| [`@vue-ecosystem/virtual-scroll`](packages/virtual-scroll)     | 🚧 planned | Headless virtual scrolling                                                          |
| [`@vue-ecosystem/form-builder`](packages/form-builder)         | 🚧 planned | Schema-driven forms and validation                                                  |
| [`@vue-ecosystem/dashboard-layout`](packages/dashboard-layout) | 🚧 planned | Draggable, resizable dashboard grid                                                 |
| [`@vue-ecosystem/tour`](packages/tour)                         | 🚧 planned | Guided product tours                                                                |

🚧 packages are skeletons: directory, README and a place in the dependency graph, no
implementation. They are marked `private` so they cannot be published by accident.

## Quick start

```bash
corepack enable     # see CONTRIBUTING.md if this fails on Node >= 25
pnpm install
pnpm build
pnpm test
pnpm playground     # live demo at http://127.0.0.1:5173 (opens automatically)
```

> Use `pnpm playground`, not `pnpm --filter vue-ecosystem-playground dev`. The app
> imports the packages through their published entry points (`dist/`), so they have to
> be built first — `pnpm playground` goes through Turborepo, which does that for you.
> `pnpm --filter … dev` bypasses Turborepo and fails to resolve the import.

## Repo layout

```
packages/     the libraries
apps/
  playground/ Vite + Vue app demoing the packages live
examples/     standalone usage examples
```

## Design decisions

Why tsup for some packages and Vite for others, why `isEcosystemError()` instead of
`instanceof`, why every package starts at `0.1.0`, why build order is not the same as
product priority — all of it is written down in
[ARCHITECTURE.md](ARCHITECTURE.md), so nobody has to re-derive it later.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Issues labelled `good first issue` are
a good entry point; every user-facing change needs a changeset.

## License

MIT
