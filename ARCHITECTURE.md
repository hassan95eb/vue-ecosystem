# Architecture

The decisions in this file are the ones that are expensive to re-derive and easy to
drift away from. They are written down so that a contributor arriving in six months —
or the same person on a later package — does not have to make them again from scratch.

---

## Table of contents

- [Build tool decision](#build-tool-decision)
- [Build order ≠ product priority](#build-order--product-priority)
- [Dependency model](#dependency-model)
- [Dual package hazard](#dual-package-hazard)
- [Versioning and release](#versioning-and-release)
- [Publishing requirements for scoped packages](#publishing-requirements-for-scoped-packages)
- [Testing setup](#testing-setup)
- [CI and remote caching](#ci-and-remote-caching)
- [Documentation site](#documentation-site)
- [Toolchain notes](#toolchain-notes)
- [Recorded deviations from the original plan](#recorded-deviations-from-the-original-plan)

---

## Build tool decision

Two build tools, each for a specific category of package. This is a deliberate split,
not a per-package judgement call — the point of writing it down is that no package
gets to reinvent it.

| Package type                                                                                                                                                                              | Build tool                                                       | Why                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logic / composables only, **no `.vue` files** — `core`, `state-machine`, `persian-tools` (phase 1: composables + directive only), `query-builder` (engine), `virtual-scroll` (composable) | **tsup** (esbuild)                                               | Faster, far lighter config, and emits ESM + CJS + `.d.ts` for multiple entry points without a bespoke rollup setup per entry                                |
| Packages with real `.vue` SFCs — `smart-table` (styled shell), `dashboard-layout`, `tour`, `form-builder`, and any package that later gains a full component                              | **Vite library mode** + `@vitejs/plugin-vue` + `vite-plugin-dts` | esbuild has no native support for `<template>` / `<script setup>` / scoped CSS; the esbuild Vue-SFC plugins are not at the maturity of `@vitejs/plugin-vue` |

**In phase 1 there is no actual conflict**: `core` and `persian-tools` both fall in the
first row, so both use tsup. The table matters from the phase where `smart-table` and
`dashboard-layout` arrive — which is exactly why it is recorded now rather than then.

Type-checking is always a **separate step** (`vue-tsc --noEmit`), never delegated to
the bundler. Neither tsup nor esbuild performs a full type-check.

## Build order ≠ product priority

The ecosystem-level ranking by impact on the brand/profile is:

```
realtime > smart-table > state-machine > query-builder > persian-tools
```

Phase 1 starts with `persian-tools` anyway. **This is not a change of priority.** It is
infrastructural de-risking: `persian-tools` is the only layer-2 package with no
side dependencies, so it is the cheapest way to prove out the
pure-function-core / composable-wrapper pattern that every other package will need.

`realtime` remains the highest product priority and is built in a later phase, per the
roadmap.

## Dependency model

```
Layer 0: core                                    -> no internal dependencies
Layer 1: state-machine, virtual-scroll           -> core
Layer 2: query-builder, realtime, persian-tools  -> core
Layer 3: smart-table       -> core + virtual-scroll + query-builder
                              (optional peer: persian-tools)
         form-builder      -> core + state-machine
                              (optional peer: persian-tools)
         tour              -> core + state-machine
         dashboard-layout  -> core
```

This is **two layers of rule, not a simple hub-and-spoke**:

1. **Baseline:** every package except `core` itself depends on `core`.
2. **On top of that:** layer-3 packages additionally depend on the specific same-level
   or lower packages listed above.

The two rules are complementary, not contradictory — but since that combination is
itself an architectural decision, it is stated explicitly here rather than left to be
inferred from the `package.json` files.

Optional dependencies (for example `persian-tools` inside `smart-table`) are declared
as `peerDependencies` with `peerDependenciesMeta: { optional: true }`, so a consumer
who does not want them is never forced to bundle them.

Internal dependencies use the **`workspace:*` protocol**. During development pnpm links
straight to the local source; at publish time Changesets rewrites it to a real semver
range. Never pin an internal dependency to a fixed version by hand.

### The `internal/` boundary is enforced, not just documented

Each package has `src/index.ts` (public exports only, no logic) and `src/internal/`
(everything else, excluded from the exports map). An ESLint `no-restricted-imports`
rule in the root config makes a cross-package import of another package's `internal/`
or `src/` a hard error. Without that rule the split is a convention, and conventions
get worked around.

## Dual package hazard

Every package emits ESM **and** CJS. If a consuming project ends up with two resolution
paths to the same package — an older bundler, a Jest CJS transform, a nested duplicate
in `node_modules` — two separate copies of the module are loaded. From JavaScript's
point of view the two `EcosystemError` classes are unrelated, so
`err instanceof EcosystemError` returns `false` for an error that genuinely is one.

**Accepted risk, with a mitigation — not just awareness.** `core` exports a tag that is
independent of class identity:

```ts
// packages/core/src/errors.ts
const ECOSYSTEM_ERROR_TAG = Symbol.for('vue-ecosystem.error') // Symbol.for, not Symbol:
// uses the global symbol
// registry, so it is identical
// across duplicated module
// instances

export class EcosystemError extends Error {
  [ECOSYSTEM_ERROR_TAG] = true
}

export function isEcosystemError(err: unknown): err is EcosystemError {
  return typeof err === 'object' && err !== null && (err as any)[ECOSYSTEM_ERROR_TAG] === true
}
```

**Every package checks error types with `isEcosystemError()`, never with a bare
`instanceof EcosystemError`.** There is a regression test in
`packages/core/tests/errors.test.ts` that simulates a duplicated module instance and
asserts that `instanceof` fails while `isEcosystemError()` still succeeds.

## Versioning and release

- **Changesets**, with **independent** per-package versioning (not lockstep).
- `updateInternalDependencies: "patch"` — when a base package such as `virtual-scroll`
  is bumped, every dependent (e.g. `smart-table`) automatically takes a patch bump.
  Publish order is derived by Changesets from the workspace graph; nothing is ordered
  by hand.
- **Pre-1.0 semver policy:** every MVP package starts at `0.1.0`, not `1.0.0`. A package
  stays on `0.x` until it meets its own v1.0 exit criteria (a11y, i18n/RTL, 80%+
  coverage, docs site, at least one `good first issue`). Staying on `0.x` means breaking
  changes during the MVP phase do not require an artificial major bump. The move to
  `1.0.0` is a deliberate, manual bump.
- Skeleton packages are marked `"private": true` until they have real content, so they
  cannot be published by accident. Removing that flag is part of shipping a package's
  MVP.

## Publishing requirements for scoped packages

Two fields belong in **every** package's `package.json` from day one, not at first
release:

```jsonc
"publishConfig": {
  "access": "public",      // required
  "provenance": true       // cheap, and worth it
}
```

- `access: "public"` — all packages are scoped (`@<org>/<name>`), and npm defaults
  scoped packages to `restricted`. Without this field, the first publish either fails
  with a 402 or, worse, quietly publishes the package as private. This is true whether
  Changesets publishes or someone runs `npm publish` by hand.
- `provenance: true` — attaches a supply-chain attestation badge on the npm page. Costs
  essentially nothing, and since a stated goal of this project is to demonstrate
  Staff-level engineering practice, it is worth having. It requires the release
  workflow to hold the `id-token: write` permission.

## Testing setup

- **One Vitest config at the repo root**, no per-package config. Two projects: `unit`
  (node environment) and `dom` (jsdom, for files named `*.dom.test.ts`).
- **Each `packages/<name>/package.json` must keep its own `test` script**, scoped to
  that package's directory:
  `vitest run --root ../.. packages/<name>/tests`.
  The root config alone does **not** give per-package Turborepo cache granularity —
  the separate scripts are what does. **Do not merge these into one root-level script**;
  doing so silently destroys per-package test caching.
- Custom matchers live in `packages/core/src/test-setup.ts` and are wired in once from
  the root config. Their **type declarations** are hand-written in
  `packages/core/matchers.d.ts` rather than generated: a bundled `.d.ts` drops the
  `import 'vitest'` line, which turns the augmentation into a module _declaration_ and
  silently deletes Vitest's own types wherever it is referenced. Each package with
  tests references them from `tests/vitest.d.ts`.

## CI and remote caching

- **Turborepo Remote Cache is enabled from phase 1** (Vercel Remote Cache, free tier):
  `turbo login` locally, and `TURBO_TOKEN` / `TURBO_TEAM` secrets in GitHub Actions.
  With nine packages plus a playground app ahead, the CI time saving is real now, not
  hypothetical.
- **`ci.yml` must degrade gracefully when those secrets are absent.** GitHub Actions
  does not expose repository secrets to workflow runs from forked PRs. Since the v1.0
  rules call for `good first issue`s aimed at outside contributors, a missing
  `TURBO_TOKEN` must simply mean "local cache only" — never a hard failure. Otherwise
  the first PR from every external contributor goes red for no reason.

## Documentation site

**VitePress** — decided in phase 1, built at v1.0. It is the natural fit for a Vue
ecosystem (Vue-native, minimal configuration, Vue components live in the docs), and
recording the decision now means nobody has to reopen it later.

## Toolchain notes

- **pnpm is pinned** via the `packageManager` field in the root `package.json`, with
  Corepack, so the version cannot drift between a local machine and CI.
- **Corepack on Node ≥ 25:** Corepack is no longer distributed with Node from version 25
  onwards (it shipped as an experimental feature up to Node 24 LTS). If `corepack enable`
  fails, install it first: `npm install -g corepack`. This is also noted in
  CONTRIBUTING.md.
- **Node version:** `engines.node` is `>=22.12.0` — the oldest LTS line still in
  maintenance — rather than pinning the newest LTS exactly, so contributors are not
  locked out by a minor version skew. `.nvmrc` records the recommended line.

## Recorded deviations from the original plan

Small, deliberate departures from the phase-1 brief, each with its reason:

1. **`vitest.workspace.ts` → `vitest.config.ts` with `test.projects`.** Vitest 3.2
   deprecated the standalone workspace file (removal in v4) and prints a warning on
   every run. The intent — a single root-level config, no per-package configs — is
   unchanged; only the file it lives in moved.
2. **Matcher types split into `packages/core/matchers.d.ts`.** See
   [Testing setup](#testing-setup): keeping them inline in `test-setup.ts` produced a
   generated `.d.ts` that broke Vitest's own types in every consuming package.
3. **Skeleton packages marked `"private": true`.** The brief asked for skeletons with a
   README and TODO. Marking them private additionally removes any chance of publishing
   an empty package; the flag comes off as part of each package's MVP.
