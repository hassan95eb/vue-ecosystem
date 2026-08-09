---
'@vue-ecosystem/smart-table': minor
---

MVP: a headless data table built on `virtual-scroll` and `query-builder`.

`useSmartTable()` owns filtering, multi-column sorting, pagination, row selection
and optional virtualisation over a client-side array, and renders nothing. Every
decision lives in a pure, Vue-free function under `internal/`: the pipeline is
`filter -> sort -> paginate`, missing values sort last in both directions, the
page index is clamped against the filtered count, and "select all" means the
filtered set rather than the visible page.

Filtering delegates to `query-builder`'s `evaluate()` rather than reimplementing
AST traversal, and `deriveSchema()` turns a column list into a schema with
literal field ids and enum values, so `useQueryBuilder(table.schema)` autocompletes.
`runPipeline`, `sortRows`, `filterRows` and the selection helpers are exported
individually for consumers with their own state layer.
