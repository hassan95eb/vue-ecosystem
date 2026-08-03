# Commit + PR text — `feat/virtual-scroll-mvp`

Scratch file. Delete it before committing (it is not part of the change).

---

## 1. Commands

```bash
cd "C:\Users\Hassan amini\Documents\Project\vue ecosystem"

# confirm you are on the right branch, based on 3c14694
git status
git log --oneline -1

# delete this scratch file so it does not get committed
del PR-virtual-scroll-mvp.md

git add packages/virtual-scroll .changeset/great-windows-listen.md pnpm-lock.yaml
git status            # review before committing

git commit            # paste the message from section 2
git push -u origin feat/virtual-scroll-mvp
```

Then open the PR against `main` with the title and body from sections 3 and 4.

---

## 2. Commit message

```
feat(virtual-scroll): add useVirtualList MVP for fixed-height rows

Windowed rendering for long lists of fixed-height rows, scoped to what
smart-table needs to unblock its own MVP.

The windowing math lives in a pure, framework-agnostic module
(internal/virtual-core.ts) with no Vue import, following the
pure-core / composable-wrapper split established by persian-tools'
internal/jalali-core.ts. useVirtualList() is the DOM and reactive glue
on top: it binds a template ref for the scroll container, attaches the
scroll listener and a ResizeObserver internally, and returns
virtualItems, totalHeight and containerRef.

Details worth knowing:

- endIndex is exclusive, so the rendered window is
  items.slice(startIndex, endIndex) and an empty window is just
  startIndex === endIndex. An inclusive end would need -1 to mean
  "nothing", which is the kind of sentinel that breeds off-by-one bugs
  in consumers.
- A scrollTop past the end of the list clamps to the last full screen
  rather than producing an empty window. This fires whenever a list
  shrinks under a scrolled-down viewport; an empty window there renders
  as a blank list. The same clamp absorbs a negative scrollTop from iOS
  rubber-banding.
- Without window or ResizeObserver the composable returns the full,
  unvirtualised list instead of throwing or rendering an empty range,
  so server markup is complete and the first client-side measurement
  narrows it to a real window.
- overscan defaults to 4. The buffer only has to cover rows a fast
  scroll can reveal between a scroll event firing and the next paint;
  4 costs a flat 8 extra rows regardless of list length.
- Validation lives in the pure core so both entry points share one
  definition of valid input and it is testable without a DOM. The
  composable asserts eagerly, so a bad itemHeight throws at the call
  site rather than lazily on first computed read.

The package moves from a private skeleton to a real, publishable 0.1.0.
Out of scope by design and still tracked in the package README:
measured/variable row heights, horizontal and grid virtualisation,
scrollToIndex and sticky rows, and the 100k-row benchmark.
```

---

## 3. PR title

```
feat(virtual-scroll): useVirtualList MVP for fixed-height rows
```

---

## 4. PR body

```markdown
## What does this change?

Ships `@vue-ecosystem/virtual-scroll`'s MVP: `useVirtualList()`, windowed
rendering for long lists of fixed-height rows. Scoped narrowly to unblock
`smart-table` (dependency-layer 3), which has a hard dependency on this
package — this is a build-order move and does not change the ecosystem-level
product ranking in ARCHITECTURE.md.

Closes #

## Which package(s)?

`@vue-ecosystem/virtual-scroll` — no other package is touched.

## Checklist

- [x] A changeset was added (`pnpm changeset`) — required for any user-facing change
- [x] Tests were added or updated, and `pnpm test` passes
- [x] Documentation was updated (package README, and ARCHITECTURE.md if a decision changed)
- [x] `pnpm lint` and `pnpm turbo run typecheck` pass
- [x] No new cross-package import of another package's `internal/` or `src/`
- [x] Error types are checked with `isEcosystemError()`, not `instanceof`

## Breaking change?

- [x] No
- [ ] Yes — described below, with a migration note

---

## Design notes

**Pure core / composable wrapper.** The windowing math is
`src/internal/virtual-core.ts` — no Vue import, so it is testable exhaustively
without mounting a component. `useVirtualList()` is the DOM and reactive glue
on top. Same split as `persian-tools`' `internal/jalali-core.ts`.

**`endIndex` is exclusive.** The rendered window is
`items.slice(startIndex, endIndex)`, and an empty window is just
`startIndex === endIndex`. An inclusive end needs `-1` to mean "nothing" —
exactly the sentinel that produces off-by-one bugs downstream.

**Clamping.** A `scrollTop` past the end clamps to the last full screen rather
than returning an empty window. This happens whenever a list shrinks under a
scrolled-down viewport, and an empty window there shows up as a blank list.
The same clamp absorbs a negative `scrollTop` from iOS rubber-banding.

**SSR.** With no `window` / `ResizeObserver`, the composable returns the full
unvirtualised list with correct offsets rather than throwing or rendering an
empty range. Server markup stays complete; the first client-side measurement
narrows it to a real window.

**`overscan` defaults to 4.** The buffer only has to cover the rows a fast
scroll can reveal between a scroll event firing and the next paint. 4 buys a
frame or two of already-mounted rows before blanking, at a flat cost of 8 extra
rows regardless of how long the list is — it does not scale with `itemCount`,
which is the point of virtualising. Configurable per call.

**Validation in the pure core.** Both entry points share one definition of
valid input, and it is testable without a DOM. `useVirtualList()` asserts
eagerly so a bad `itemHeight` throws at the call site, not lazily on first
`computed` read. Two codes: `virtual-scroll/invalid-item-height` and
`virtual-scroll/invalid-overscan`, both via
`VirtualScrollError extends EcosystemError`.

**Public surface.** The pure core is exported from `index.ts`
(`computeVirtualRange`, `computeTotalHeight`, `offsetForIndex`,
`DEFAULT_OVERSCAN`) — `smart-table` may want the math without the composable,
and the `internal/` boundary rule correctly forbids it reaching in directly.

## Out of scope, by design

Still tracked in the package README's TODO: measured / variable row heights,
horizontal and grid virtualisation, `scrollToIndex` and sticky rows, and the
100k-row benchmark.

## Verification

`build`, `typecheck`, `test` (28 passing — 17 unit on the pure core, 11 DOM on
the composable) and root `pnpm lint` all pass, plus `prettier --check` and
`pnpm install --frozen-lockfile`.

## Notes for the reviewer

- `"private": true` is removed from `package.json` — this is the skeleton →
  publishable `0.1.0` transition, same as `realtime`'s MVP pass.
- Build scripts were `echo "skeleton — nothing to build yet"` placeholders and
  there was no `tsup.config.ts`; both are now real, modelled on `realtime`.
- `pnpm-lock.yaml` moves 8 lines — only the two new devDependencies (`tsup`,
  `vue`). Required, or CI's `--frozen-lockfile` fails.
- `homepage` and `bugs` added to `package.json` for parity with `realtime` and
  `persian-tools`.
```

---

## 5. Two follow-ups, not in this PR

**Line endings.** The repo has no `.gitattributes` and no `core.autocrlf`, so
editors that write CRLF re-dirty files on open — this is what made
`packages/persian-tools/{CHANGELOG.md,package.json}` show as fully modified with
zero content change. Worth a separate commit:

```bash
git checkout -b chore/normalize-line-endings
printf '* text=auto eol=lf\n' > .gitattributes
git add .gitattributes
git add --renormalize .
git commit -m "chore: normalize line endings with .gitattributes"
```

**Issue first.** CONTRIBUTING.md asks for an issue before non-trivial work, and
the PR template has a `Closes #`. Open one for the virtual-scroll MVP and fill
in the number.
