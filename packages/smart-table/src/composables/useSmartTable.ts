import {
  computed,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from 'vue'
import type { MaybeRefOrGetter } from '@vue-ecosystem/core'
import type { QueryAst } from '@vue-ecosystem/query-builder'
import { useVirtualList, type VirtualItem } from '@vue-ecosystem/virtual-scroll'
import {
  assertValidColumns,
  deriveSchema,
  type AnyColumnDef,
  type ColumnDef,
  type SchemaFor,
} from '../internal/columns'
import { assertValidPageSize } from '../internal/pagination'
import { runPipeline, type PipelineResult } from '../internal/pipeline'
import {
  defaultRowId,
  isAllSelected as isAllSelectedOf,
  isIndeterminate as isIndeterminateOf,
  resolveRowId,
  setSelected as setSelectedIn,
  toggleAll as toggleAllIn,
  toggleSelection,
  type RowId,
  type RowIdResolver,
  type SelectionMode,
} from '../internal/selection'
import {
  cycleSort,
  directionFor as directionForIn,
  priorityFor as priorityForIn,
  type SortDirection,
  type SortRule,
} from '../internal/sort'

export interface UseSmartTableVirtualOptions {
  /** Fixed row height in pixels. Passed straight to `useVirtualList`. */
  readonly itemHeight: number
  /** Rows rendered beyond each edge of the viewport. */
  readonly overscan?: number
}

export interface UseSmartTableOptions<T, C extends readonly ColumnDef<T>[]> {
  readonly columns: C
  /**
   * How to identify a row. Defaults to reading `row.id`.
   *
   * @throws {@link SmartTableError} `smart-table/missing-row-id` on the first
   * pass over the rows if it yields nothing usable -- eagerly, not when a
   * checkbox is first clicked.
   */
  readonly rowId?: RowIdResolver<T>
  /** Defaults to `'none'`: a table without checkboxes should not carry the state for them. */
  readonly selection?: SelectionMode
  /** Omit for no pagination. Every filtered row is then rendered. */
  readonly pageSize?: number
  readonly initialSort?: readonly SortRule[]
  readonly initialQuery?: QueryAst | null
  readonly initialGlobalFilter?: string
  /** Applies to both the structured filter and the global one. Defaults to `false`. */
  readonly caseSensitive?: boolean
  /** BCP 47 tag for the sort collator. Defaults to the host locale. */
  readonly locale?: string
  /** Enable windowed rendering of the current page. */
  readonly virtual?: UseSmartTableVirtualOptions
}

/** One row, as the renderer wants it. */
export interface TableRow<T> {
  readonly id: RowId
  /** Position in the filtered-and-sorted view, not in the source array. Feed it to `aria-rowindex`. */
  readonly index: number
  readonly row: T
  readonly selected: boolean
}

export interface TableVirtualiser<T> {
  readonly virtualItems: ComputedRef<VirtualItem<TableRow<T>>[]>
  readonly totalHeight: ComputedRef<number>
  readonly containerRef: Ref<HTMLElement | null>
}

export interface UseSmartTableReturn<T, C extends readonly ColumnDef<T>[]> {
  readonly columns: C
  /** Ready for `useQueryBuilder`, with column ids and enum values as literal types. */
  readonly schema: SchemaFor<C>

  /** The rows to render: one page, or all filtered rows when unpaginated. */
  readonly rows: ComputedRef<TableRow<T>[]>
  /** Rows passing the filters, before pagination. Drives "showing N of M". */
  readonly filteredCount: ComputedRef<number>
  readonly totalCount: ComputedRef<number>

  readonly sort: Ref<readonly SortRule[]>
  /** Advance one column through `none -> asc -> desc -> none`. */
  toggleSort(columnId: string, options?: { readonly multi?: boolean }): void
  setSort(rules: readonly SortRule[]): void
  clearSort(): void
  /** For the header arrow. */
  directionFor(columnId: string): SortDirection | null
  /** 1-based badge for multi-column sorts, `0` when unsorted. */
  priorityFor(columnId: string): number

  /** The structured filter. Assign `useQueryBuilder(...).ast.value` into it. */
  readonly query: Ref<QueryAst | null>
  /** Free-text search across searchable columns. */
  readonly globalFilter: Ref<string>

  /** 0-based. Reading gives the clamped value; writing is clamped on read. */
  readonly pageIndex: WritableComputedRef<number>
  /** `null` disables pagination. */
  readonly pageSize: Ref<number | null>
  readonly pageCount: ComputedRef<number>
  readonly hasPreviousPage: ComputedRef<boolean>
  readonly hasNextPage: ComputedRef<boolean>
  nextPage(): void
  previousPage(): void

  readonly selectedIds: ComputedRef<ReadonlySet<RowId>>
  /** In view order, and only rows still passing the filter. */
  readonly selectedRows: ComputedRef<T[]>
  isSelected(id: RowId): boolean
  toggleRow(id: RowId): void
  setRowSelected(id: RowId, selected: boolean): void
  /** Selects or clears every **filtered** row, not just the visible page. */
  toggleAllRows(): void
  clearSelection(): void
  readonly isAllSelected: ComputedRef<boolean>
  /** `aria-checked="mixed"` on the header checkbox. */
  readonly isIndeterminate: ComputedRef<boolean>

  /** `null` unless the `virtual` option was given. */
  readonly virtual: TableVirtualiser<T> | null
}

/**
 * A headless data table: filtering, sorting, pagination, selection and
 * optional virtualisation over a client-side array.
 *
 * Deliberately thin. Every decision -- pipeline order, missing-value ordering,
 * page clamping, what "select all" means -- lives in a pure function under
 * `internal/` and is tested without mounting anything. This file is wiring: if
 * a bug here is ever more than a wiring mistake, logic has leaked upwards and
 * belongs back down.
 *
 * ```ts
 * const columns = defineColumns<Invoice>()([
 *   { id: 'number', kind: 'string' },
 *   { id: 'total', kind: 'number' },
 *   { id: 'status', kind: 'enum', values: ['draft', 'sent', 'paid'] },
 * ])
 *
 * const table = useSmartTable(invoices, { columns, pageSize: 25, selection: 'multiple' })
 * const filter = useQueryBuilder(table.schema)
 * watchEffect(() => { table.query.value = filter.ast.value })
 * ```
 *
 * @throws {@link SmartTableError} `smart-table/duplicate-column-id`,
 * `smart-table/invalid-column-id`, `smart-table/invalid-enum-column` or
 * `smart-table/invalid-page-size`, synchronously from this call.
 */
export function useSmartTable<T, const C extends readonly ColumnDef<T>[]>(
  source: MaybeRefOrGetter<T[]>,
  options: UseSmartTableOptions<T, C>,
): UseSmartTableReturn<T, C> {
  const columns = options.columns
  assertValidColumns(columns as readonly AnyColumnDef[])
  if (options.pageSize !== undefined) assertValidPageSize(options.pageSize)

  const schema = deriveSchema(columns as readonly AnyColumnDef[]) as SchemaFor<C>
  const rowIdOf: RowIdResolver<T> = options.rowId ?? defaultRowId
  const mode: SelectionMode = options.selection ?? 'none'

  const sort = ref<readonly SortRule[]>(options.initialSort ?? []) as Ref<readonly SortRule[]>
  const query = ref<QueryAst | null>(options.initialQuery ?? null) as Ref<QueryAst | null>
  const globalFilter = ref(options.initialGlobalFilter ?? '')
  const pageSize = ref<number | null>(options.pageSize ?? null)
  const requestedPageIndex = ref(0)

  // A `Set` in a deep `ref` would be proxied and every `has()` would go through
  // the reactive handler; the set is always *replaced*, never mutated, so a
  // shallow ref tracks it correctly and stays cheap.
  const selectedIds = shallowRef<ReadonlySet<RowId>>(new Set())

  // Narrowing the filter shrinks the page count, so page 9 of 3 must not
  // survive it. Clamping alone would leave the user on the last page of a
  // result set they have just replaced; going back to the first page is what
  // every table does and what the user means by typing in the box.
  watch([query, globalFilter], () => {
    requestedPageIndex.value = 0
  })

  const result = computed<PipelineResult<T>>(() =>
    runPipeline(
      toValue(source),
      columns as readonly ColumnDef<T>[],
      {
        sort: sort.value,
        query: query.value,
        globalFilter: globalFilter.value,
        pageIndex: requestedPageIndex.value,
        pageSize: pageSize.value,
      },
      { caseSensitive: options.caseSensitive === true, locale: options.locale },
    ),
  )

  /** Ids of every filtered row, in view order. The "select all" set. */
  const allIds = computed<RowId[]>(() =>
    result.value.sorted.map((row, index) => resolveRowId(row, index, rowIdOf)),
  )

  const offset = computed(() =>
    pageSize.value === null ? 0 : result.value.pageIndex * pageSize.value,
  )

  const rows = computed<TableRow<T>[]>(() =>
    result.value.rows.map((row, i) => {
      const index = offset.value + i
      const id = resolveRowId(row, index, rowIdOf)
      return { id, index, row, selected: selectedIds.value.has(id) }
    }),
  )

  const pageIndex: WritableComputedRef<number> = computed({
    get: () => result.value.pageIndex,
    set: (value) => {
      requestedPageIndex.value = value
    },
  })

  const virtual: TableVirtualiser<T> | null =
    options.virtual === undefined
      ? null
      : // Called conditionally, which is fine here and only here: `options` is
        // read once, at setup, so the branch is fixed for the lifetime of this
        // composable. There is no render in which it is taken differently.
        useVirtualList<TableRow<T>>(() => rows.value, {
          itemHeight: options.virtual.itemHeight,
          overscan: options.virtual.overscan,
        })

  return {
    columns,
    schema,

    rows,
    filteredCount: computed(() => result.value.filtered.length),
    totalCount: computed(() => toValue(source).length),

    sort,
    toggleSort(columnId, toggleOptions = {}) {
      sort.value = cycleSort(sort.value, columnId, toggleOptions)
    },
    setSort(rules) {
      sort.value = rules
    },
    clearSort() {
      sort.value = []
    },
    directionFor: (columnId) => directionForIn(sort.value, columnId),
    priorityFor: (columnId) => priorityForIn(sort.value, columnId),

    query,
    globalFilter,

    pageIndex,
    pageSize,
    pageCount: computed(() => result.value.pageCount),
    hasPreviousPage: computed(() => result.value.pageIndex > 0),
    hasNextPage: computed(() => result.value.pageIndex < result.value.pageCount - 1),
    nextPage() {
      requestedPageIndex.value = result.value.pageIndex + 1
    },
    previousPage() {
      requestedPageIndex.value = result.value.pageIndex - 1
    },

    selectedIds: computed(() => selectedIds.value),
    selectedRows: computed(() =>
      result.value.sorted.filter((row, index) =>
        selectedIds.value.has(resolveRowId(row, index, rowIdOf)),
      ),
    ),
    isSelected: (id) => selectedIds.value.has(id),
    toggleRow(id) {
      selectedIds.value = toggleSelection(selectedIds.value, id, mode)
    },
    setRowSelected(id, selected) {
      selectedIds.value = setSelectedIn(selectedIds.value, id, selected, mode)
    },
    toggleAllRows() {
      selectedIds.value = toggleAllIn(selectedIds.value, allIds.value, mode)
    },
    clearSelection() {
      selectedIds.value = new Set()
    },
    isAllSelected: computed(() => isAllSelectedOf(selectedIds.value, allIds.value)),
    isIndeterminate: computed(() => isIndeterminateOf(selectedIds.value, allIds.value)),

    virtual,
  }
}
