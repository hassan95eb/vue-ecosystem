# Contributing

Thanks for considering it. This guide covers local setup, the day-to-day commands,
and the few conventions that are enforced rather than suggested.

## Prerequisites

- **Node.js** — an active LTS line, 22.12 or newer (`.nvmrc` records the recommended one)
- **pnpm** — do not install it manually; the version is pinned by the `packageManager`
  field and provided by Corepack

```bash
corepack enable
```

> **If `corepack enable` fails**, you are most likely on **Node 25 or newer**. Corepack
> is no longer distributed with Node from v25 onwards (it shipped as an experimental
> feature up to Node 24 LTS). Install it first, then retry:
>
> ```bash
> npm install -g corepack
> corepack enable
> ```

## Setup

```bash
git clone https://github.com/hassan95eb/vue-ecosystem.git
cd vue-ecosystem
pnpm install
pnpm build     # packages depend on each other's dist output
pnpm test
```

Run the live playground:

```bash
pnpm playground     # http://127.0.0.1:5173 -- opens in your browser automatically
```

## Commands

| Command                                               | What it does                                                |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm build`                                          | Build every package (Turborepo, cached, dependency-ordered) |
| `pnpm test`                                           | Run all tests                                               |
| `pnpm test:coverage`                                  | Tests with a coverage report                                |
| `pnpm lint`                                           | ESLint across the workspace                                 |
| `pnpm typecheck`                                      | `vue-tsc --noEmit` per package                              |
| `pnpm format`                                         | Prettier write                                              |
| `pnpm changeset`                                      | Record a change for the next release                        |
| `pnpm playground`                                     | Build the packages, then start the demo app                 |
| `pnpm --filter @vue-ecosystem/persian-tools <script>` | Run a script in one package                                 |

Turborepo caches by task and package. Run `pnpm build` twice — the second is a cache hit.
To use the shared remote cache, run `pnpm exec turbo login` and `pnpm exec turbo link`.
It is optional: without it everything still works from the local cache.

## Troubleshooting

**`ERR_CONNECTION_REFUSED` on the playground URL** — the dev server is not listening
on the address the browser asked for. Three things to check, in order:

1. **Read the terminal.** `pnpm playground` builds `core` and `persian-tools` before
   Vite starts; on a cold cache that takes a while. The server is only up once you see
   `VITE v6.x ready in …`.
2. **Use the URL the terminal prints**, which is `http://127.0.0.1:5173/`. Not
   `localhost`: on Windows `localhost` often resolves to `::1` while the server is
   bound to `127.0.0.1`, and the browser reports a refused connection even though the
   server is running fine. That is why the config pins the host rather than leaving it
   as `localhost`.
3. **If Vite exits with "Port 5173 is already in use"**, something else has the port.
   `strictPort` is on deliberately so this fails loudly instead of silently moving to
   5174 while every doc still says 5173. Stop the other process, or change `port` in
   `apps/playground/vite.config.ts`.

**`vite: not found`, or any `<tool>: not found`** — dependencies are not installed.
Run `pnpm install` from the repo root.

**`Failed to resolve import "@vue-ecosystem/persian-tools"`** — the packages have not
been built. They resolve each other through `dist/`, which is not in git. Run
`pnpm build`, or use `pnpm playground`, which builds first. Running
`pnpm --filter vue-ecosystem-playground dev` directly bypasses Turborepo and skips
that build — use `pnpm playground` instead.

**`pnpm install` fails in `prepare`** — it should not: git hook installation is
best-effort and never fails the install. If it does, please open an issue with the
output.

**Something builds locally but fails in CI** — run `pnpm exec turbo run build --force`
to bypass the cache, then compare.

## Making a change

1. **Open an issue first** for anything beyond a small fix. The MVP scope of each
   package is decided deliberately.
2. Branch from `main`.
3. Write the change **and** its tests.
4. **Add a changeset** — this is required for any user-facing change:
   ```bash
   pnpm changeset
   ```
   Pick the affected packages, pick a bump type, and write one or two sentences. That
   text becomes the CHANGELOG entry. While a package is on `0.x`, a breaking change is
   a **minor** bump, not a major one.
5. Open a PR and fill in the template.

## Conventions that are enforced

**Public vs internal.** Each package has `src/index.ts` — public exports only, no logic —
and `src/internal/`, which is not in the exports map. An ESLint rule makes importing
another package's `internal/` or `src/` a hard error. Keep new logic in `internal/` and
re-export from `index.ts`.

**Error handling.** Extend `EcosystemError` from `@vue-ecosystem/core`, give it a
namespaced `code` (`persian-tools/invalid-jalali-date`), and check error types with
`isEcosystemError()` — never `instanceof`. The reason is in
[ARCHITECTURE.md](ARCHITECTURE.md#dual-package-hazard).

**Framework-agnostic core.** Business logic goes in plain functions with no Vue import.
Composables and directives are thin wrappers over them. `persian-tools` is the reference
implementation of this split.

**Vue is a peer dependency**, always — never a direct dependency.

**Internal dependencies use `workspace:*`.** Never pin a sibling package to a fixed
version by hand.

**Per-package `test` scripts stay separate.** Each package's `package.json` has its own
`test` script scoped to its own directory. Do not consolidate them into a single root
script — that silently breaks per-package Turborepo caching.

## Adding tests to a package

Tests live in `packages/<name>/tests/`. There is one Vitest config, at the repo root.

- `foo.test.ts` runs in the **node** environment
- `foo.dom.test.ts` runs in **jsdom** — use this for composables and directives

To use the shared custom matchers, add a one-line `tests/vitest.d.ts`:

```ts
import '@vue-ecosystem/core/matchers'
```

Then `expect(err).toBeEcosystemError('persian-tools/invalid-jalali-date')` type-checks.

## Adding a new package

1. Copy the structure of an existing package (`src/index.ts`, `src/internal/`, `tests/`,
   `package.json`, `tsconfig.json`, `tsup.config.ts` **or** `vite.config.ts`).
2. Pick the build tool from the table in
   [ARCHITECTURE.md](ARCHITECTURE.md#build-tool-decision) — do not decide ad hoc.
3. Start at version `0.1.0`.
4. Include `publishConfig: { access: "public", provenance: true }`. Scoped packages
   default to `restricted` on npm; without this the first publish fails or, worse,
   publishes privately.
5. Keep `"private": true` until the package actually has content.

## Code style

TypeScript strict mode, Prettier for formatting, ESLint for correctness. A pre-commit
hook (lefthook) runs both on staged files, so you rarely need to think about it. Comments
should explain _why_, not restate the code.

## Questions

Open a discussion or an issue. Issues labelled `good first issue` are a deliberate entry
point for new contributors — if one is unclear, say so on the issue and it will be
rewritten.
