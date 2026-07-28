# Changesets

Every user-facing change needs a changeset. Run `pnpm changeset` and describe the
change in one or two sentences -- that text becomes the CHANGELOG entry.

Versioning is **independent per package**, not lockstep. Internal dependents get an
automatic `patch` bump (`updateInternalDependencies: "patch"`), and publish order is
derived from the workspace dependency graph -- nothing here is managed by hand.

All MVP packages sit on `0.x`. Moving a package to `1.0.0` is a deliberate manual
bump made only once it meets its v1.0 exit criteria (see ARCHITECTURE.md).
