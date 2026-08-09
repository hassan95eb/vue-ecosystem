// Public API surface. No logic here by design -- the exports map and the
// `internal/` boundary lint rule both point at exactly this file.

// --- Columns ------------------------------------------------------------
export { defineColumns, deriveSchema, getCellValue, columnKind } from './internal/columns'
export type { AnyColumnDef, ColumnDef, ColumnKind, SchemaFor } from './internal/columns'

// --- Sorting ------------------------------------------------------------
// Pure and framework-agnostic. Exported so a consumer sorting on the server, or
// rendering its own headers, gets the same missing-value and collation rules
// rather than a second, subtly different implementation.
export {
  compareCells,
  compareMissing,
  cycleSort,
  directionFor,
  priorityFor,
  sortRows,
} from './internal/sort'
export type { SortDirection, SortOptions, SortRule } from './internal/sort'

// --- Filtering ----------------------------------------------------------
export { filterRows, matchesGlobalFilter, toQueryRecord } from './internal/filter'
export type { FilterOptions } from './internal/filter'

// --- Pagination ---------------------------------------------------------
export {
  clampPageIndex,
  pageCountFor,
  paginateRows,
  DEFAULT_PAGE_SIZE,
} from './internal/pagination'

// --- Selection ----------------------------------------------------------
export {
  defaultRowId,
  isAllSelected,
  isIndeterminate,
  resolveRowId,
  setSelected,
  toggleAll,
  toggleSelection,
} from './internal/selection'
export type { RowId, RowIdResolver, SelectionMode } from './internal/selection'

// --- The pipeline -------------------------------------------------------
// filter -> sort -> paginate, as one pure call. Useful on its own for a
// server-side implementation or a test that wants the whole table without Vue.
export { runPipeline } from './internal/pipeline'
export type { PipelineOptions, PipelineResult, TableState } from './internal/pipeline'

// --- The composable -----------------------------------------------------
export { useSmartTable } from './composables/useSmartTable'
export type {
  TableRow,
  TableVirtualiser,
  UseSmartTableOptions,
  UseSmartTableReturn,
  UseSmartTableVirtualOptions,
} from './composables/useSmartTable'

// --- Errors -------------------------------------------------------------
export { SmartTableError } from './internal/errors'
