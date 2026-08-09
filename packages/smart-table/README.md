# @vue-ecosystem/smart-table

Headless data table for Vue 3: filtering, multi-column sorting, pagination, row
selection and optional virtualisation, over a client-side array.

- **Dependency layer:** 3 — `core` + [`virtual-scroll`](../virtual-scroll) + [`query-builder`](../query-builder)
- **Build tool:** tsup — logic only, no `.vue` files yet ([ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision))
- **Version:** `0.x` — stays there until it meets its v1.0 exit criteria

**Headless** means this package owns the state and the algorithms and renders
nothing. You write the `<table>`, which is the part every design system wants
different anyway; the parts nobody wants to write twice — pipeline order, stable
multi-column sorting, tri-state header checkboxes, page clamping — live here.

## Install

```bash
pnpm add @vue-ecosystem/smart-table
```

`vue` (^3.4) is a peer dependency.

## `useSmartTable()`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { defineColumns, useSmartTable } from '@vue-ecosystem/smart-table'

interface Invoice {
  id: number
  number: string
  total: number
  status: 'draft' | 'sent' | 'paid'
  issuedAt: string
}

const invoices = ref<Invoice[]>([])

const columns = defineColumns<Invoice>()([
  { id: 'number', kind: 'string', header: 'Invoice' },
  { id: 'total', kind: 'number' },
  { id: 'status', kind: 'enum', values: ['draft', 'sent', 'paid'] },
  { id: 'issuedAt', kind: 'date' },
])

const table = useSmartTable(invoices, {
  columns,
  pageSize: 25,
  selection: 'multiple',
})
</script>

<template>
  <input v-model="table.globalFilter.value" placeholder="Search" />

  <table>
    <thead>
      <tr>
        <th>
          <input
            type="checkbox"
            :checked="table.isAllSelected.value"
            :indeterminate="table.isIndeterminate.value"
            @change="table.toggleAllRows()"
          />
        </th>
        <th
          v-for="column in columns"
          :key="column.id"
          :aria-sort="
            table.directionFor(column.id) === 'asc'
              ? 'ascending'
              : table.directionFor(column.id) === 'desc'
                ? 'descending'
                : 'none'
          "
          @click="table.toggleSort(column.id, { multi: $event.shiftKey })"
        >
          {{ column.header ?? column.id }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in table.rows.value" :key="row.id">
        <td>
          <input type="checkbox" :checked="row.selected" @change="table.toggleRow(row.id)" />
        </td>
        <td v-for="column in columns" :key="column.id">{{ row.row[column.id] }}</td>
      </tr>
    </tbody>
  </table>

  <button :disabled="!table.hasPreviousPage.value" @click="table.previousPage()">Previous</button>
  <span>Page {{ table.pageIndex.value + 1 }} of {{ table.pageCount.value }}</span>
  <button :disabled="!table.hasNextPage.value" @click="table.nextPage()">Next</button>
</template>
```

### Columns

A column is not only "what to render in this cell" — it is also the field a
filter names and the value a comparator orders. Declaring `kind` once is what
lets `deriveSchema()` hand the filter builder a schema that is already correct
instead of asking you to write it twice.

| Option       | Type                                                    | Default    | Notes                                                        |
| ------------ | ------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `id`         | `string`                                                | —          | Filter field, sort key, and the default row property to read |
| `kind`       | `'string' \| 'number' \| 'boolean' \| 'date' \| 'enum'` | `'string'` | `'enum'` additionally requires `values`                      |
| `values`     | `readonly string[]`                                     | —          | Enum members. Also the **sort order**                        |
| `header`     | `string`                                                | `id`       | Display label; becomes the schema field label                |
| `accessor`   | `(row: T) => unknown`                                   | `row[id]`  | Return the _comparable_ value, not the formatted one         |
| `sortable`   | `boolean`                                               | `true`     |                                                              |
| `filterable` | `boolean`                                               | `true`     | `false` drops it from the derived schema, in the types too   |
| `searchable` | `boolean`                                               | `true`     | Include in the global text filter                            |
| `compare`    | `(a, b) => number`                                      | by `kind`  | Ascending; missing values never reach it                     |

> **Why `defineColumns<T>()([...])` and not `defineColumns<T>([...])`?**
> TypeScript has no partial type-argument inference: passing `T` explicitly stops
> the column tuple from being inferred, every `id` widens to `string`, and you
> lose field-name autocomplete in the filter builder. The extra `()` buys it back.

### Filtering

Two independent filters; a row must pass both.

**The global filter** is one free-text box, matched case-insensitively as a
substring across every `searchable` column.

**The structured filter** is a [`query-builder`](../query-builder) AST. This
package does not reimplement AST traversal — it projects each row into a record
keyed by column id and calls that package's `evaluate()`, so the missing-value
rules, the case folding and the operator semantics are defined in exactly one
place.

```ts
import { useQueryBuilder } from '@vue-ecosystem/query-builder'
import { watchEffect } from 'vue'

const filter = useQueryBuilder(table.schema) // ids and enum values autocomplete
filter.addCondition([], 'status', 'in', ['sent', 'paid'])

watchEffect(() => {
  table.query.value = filter.ast.value
})
```

Because the AST is plain JSON, that filter serialises straight into a URL, a
saved view or a database column.

### Sorting

`toggleSort(columnId)` cycles `none → asc → desc → none`. The third state is not
an oversight: without it there is no way back to the order the data arrived in.
Pass `{ multi: true }` (typically on shift-click) to add a column rather than
replace the current one; array order is the priority, and `priorityFor()` gives
you the `1` / `2` badge.

- **Missing values sort last in both directions.** Flipping the direction should
  show you the other end of the data, not a screen of blanks.
- Present-but-uncomparable values (`NaN`, an unparseable date) sort after
  comparable ones, and that ordering _does_ flip with the direction.
- The sort is **stable**, so equal rows keep the source order.
- Strings use `Intl.Collator`, not `<`. Pass `locale` to pin it — the host
  locale is right for an app and wrong for a snapshot test.
- Enum columns sort by their declared `values`, not alphabetically.

### Pagination

`pageIndex` is 0-based everywhere, including in the public API; the label a user
reads is `pageIndex + 1`. Omit `pageSize` for no pagination. The page index is
clamped against the **filtered** count, and typing into a filter returns you to
page 1 — landing on page 9 of a result set you have just replaced is not useful.

### Selection

Selection is keyed by row id, never by index: an index identifies a position in
the current view, and the current view is whatever the filter and sort happen to
produce. `rowId` defaults to reading `row.id`; a row with no usable id raises
`smart-table/missing-row-id` on the first pass over the rows rather than
silently selecting the wrong record later.

`toggleAllRows()` covers every **filtered** row, not the visible page — selecting
only the current page is the behaviour users report as a bug. Rows selected
before a filter narrowed the set are preserved.

### Virtualisation

Pass `virtual` to window the rendered rows through
[`virtual-scroll`](../virtual-scroll). It composes with pagination (a large page,
virtualised) or replaces it (`pageSize` omitted, one long virtualised list).

```ts
const table = useSmartTable(rows, { columns, virtual: { itemHeight: 36 } })
// table.virtual!.virtualItems -> VirtualItem<TableRow<T>>[]
```

### Returns

| Name                                | Type                                          | Notes                                        |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `rows`                              | `ComputedRef<TableRow<T>[]>`                  | `{ id, index, row, selected }`               |
| `filteredCount` / `totalCount`      | `ComputedRef<number>`                         | For "showing N of M"                         |
| `sort`                              | `Ref<readonly SortRule[]>`                    | Also `toggleSort`, `setSort`, `clearSort`    |
| `directionFor` / `priorityFor`      | `(columnId) => …`                             | Header arrow and multi-sort badge            |
| `query` / `globalFilter`            | `Ref<QueryAst \| null>` / `Ref<string>`       |                                              |
| `pageIndex`                         | `WritableComputedRef<number>`                 | Reads back clamped                           |
| `pageSize` / `pageCount`            | `Ref<number \| null>` / `ComputedRef<number>` |                                              |
| `hasPreviousPage` / `hasNextPage`   | `ComputedRef<boolean>`                        | Plus `nextPage()` / `previousPage()`         |
| `selectedIds` / `selectedRows`      | `ComputedRef<…>`                              | `selectedRows` is view-ordered and filtered  |
| `isAllSelected` / `isIndeterminate` | `ComputedRef<boolean>`                        | Tri-state header checkbox                    |
| `schema`                            | `SchemaFor<C>`                                | Feed it to `useQueryBuilder`                 |
| `virtual`                           | `TableVirtualiser<T> \| null`                 | `null` unless the `virtual` option was given |

### Errors

All thrown synchronously from the `useSmartTable()` call, except
`missing-row-id`, which is thrown on the first pass over the rows:

| Code                              | When                                        |
| --------------------------------- | ------------------------------------------- |
| `smart-table/invalid-column-id`   | A column id is not a non-empty string       |
| `smart-table/duplicate-column-id` | Two columns share an id                     |
| `smart-table/invalid-enum-column` | An `enum` column has no `values`            |
| `smart-table/invalid-page-size`   | `pageSize` is not an integer greater than 0 |
| `smart-table/missing-row-id`      | A row yields no usable id                   |

Check them with `isEcosystemError()` from `@vue-ecosystem/core`, never with
`instanceof` — see [ARCHITECTURE.md](../../ARCHITECTURE.md#dual-package-hazard).

## The pure core

The whole table is one pure function, exported for a server-side implementation
or a test that wants the pipeline without Vue:

```ts
import { runPipeline } from '@vue-ecosystem/smart-table'

const { rows, filtered, sorted, pageCount, pageIndex } = runPipeline(allRows, columns, {
  sort,
  query,
  globalFilter,
  pageIndex: 0,
  pageSize: 25,
})
```

The order is **filter → sort → paginate**, and it is not configurable. Sorting
before filtering orders rows that are about to be discarded; paginating before
sorting sorts _within a page_, which produces a table where page 2 starts over
at "A". `filterRows`, `sortRows`, `paginateRows` and the selection helpers are
exported individually too.

## TODO

- [x] MVP: headless table core (columns, sorting, filtering, pagination, selection)
- [x] Virtualised rows via `virtual-scroll`
- [x] Structured filtering backed by `query-builder`
- [ ] Styled SFC shell — the package's move to Vite library mode
- [ ] a11y: full keyboard grid navigation, correct ARIA grid roles
- [ ] Column resizing, reordering and visibility
- [ ] Row grouping and aggregation
- [ ] Server-side mode (sort/filter/page as events, data fetched by the consumer)
- [ ] Optional Jalali/Persian column formatters via `persian-tools`

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
