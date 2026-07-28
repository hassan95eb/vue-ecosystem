## What does this change?

<!-- One or two sentences. Link the issue it closes. -->

Closes #

## Which package(s)?

<!-- e.g. @vue-ecosystem/persian-tools -->

## Checklist

- [ ] A changeset was added (`pnpm changeset`) — required for any user-facing change
- [ ] Tests were added or updated, and `pnpm test` passes
- [ ] Documentation was updated (package README, and ARCHITECTURE.md if a decision changed)
- [ ] `pnpm lint` and `pnpm turbo run typecheck` pass
- [ ] No new cross-package import of another package's `internal/` or `src/`
- [ ] Error types are checked with `isEcosystemError()`, not `instanceof`

## Breaking change?

- [ ] No
- [ ] Yes — described below, with a migration note

<!-- While packages are on 0.x a breaking change is a minor bump, not a major one. -->
