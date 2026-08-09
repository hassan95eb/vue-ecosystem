/**
 * Row selection.
 *
 * ## Why selection is keyed by id and never by index
 *
 * An index identifies a *position in the current view*, and the current view is
 * whatever the filter and sort happen to produce. Select row 3, type into the
 * search box, and an index-keyed selection now points at a different record --
 * silently, with no error and no visual glitch, until the user clicks "delete
 * selected". Ids are the only identity that survives the pipeline, so a row
 * without one is treated as a programming error rather than papered over with a
 * positional fallback. See {@link missingRowId}.
 *
 * ## "Select all" means the filtered set, not the page
 *
 * The header checkbox selects every row that passes the current filter, not the
 * 25 currently rendered. Selecting only the visible page is the behaviour users
 * report as a bug ("I ticked the box and it only deleted the first page"), and
 * it makes the tri-state checkbox lie whenever pagination is on.
 */

import { missingRowId } from './errors'

export type RowId = string | number

export type SelectionMode = 'none' | 'single' | 'multiple'

/** Returns the row's identity. Returning `null`/`undefined` raises an error. */
export type RowIdResolver<T> = (row: T, index: number) => RowId | null | undefined

/** Reads `row.id`. Used when the `rowId` option is omitted. */
export function defaultRowId<T>(row: T): RowId | null | undefined {
  if (row === null || typeof row !== 'object') return null
  const id: unknown = (row as Record<string, unknown>).id
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

/** @throws {@link SmartTableError} `smart-table/missing-row-id` */
export function resolveRowId<T>(row: T, index: number, resolver: RowIdResolver<T>): RowId {
  const id = resolver(row, index)
  if (id === null || id === undefined || (typeof id === 'number' && Number.isNaN(id))) {
    throw missingRowId(index)
  }
  return id
}

/**
 * Toggle one row. Returns a new set; the input is never mutated, so a `ref`
 * holding it triggers on identity and there is no deep-reactivity question.
 *
 * `'single'` collapses to at most one id -- clicking the selected row clears it,
 * which is how radio-like table selection is expected to behave. `'none'`
 * always returns an empty set, so the mode is enforced in one place rather than
 * guarded at every call site.
 */
export function toggleSelection(
  selected: ReadonlySet<RowId>,
  id: RowId,
  mode: SelectionMode,
): Set<RowId> {
  if (mode === 'none') return new Set()
  if (mode === 'single') return selected.has(id) ? new Set() : new Set([id])

  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

/** Force one row's state rather than flipping it. */
export function setSelected(
  selected: ReadonlySet<RowId>,
  id: RowId,
  isSelected: boolean,
  mode: SelectionMode,
): Set<RowId> {
  if (mode === 'none') return new Set()
  if (!isSelected) {
    const next = new Set(selected)
    next.delete(id)
    return next
  }
  if (mode === 'single') return new Set([id])
  return new Set(selected).add(id)
}

/**
 * The header checkbox. Selects every id in `ids` when not all are selected,
 * clears them when they already are.
 *
 * Ids outside `ids` (a row selected before the filter narrowed) are preserved
 * on select and left alone on clear: the user selected them deliberately and
 * typing in a search box is not an instruction to unselect.
 */
export function toggleAll(
  selected: ReadonlySet<RowId>,
  ids: readonly RowId[],
  mode: SelectionMode,
): Set<RowId> {
  if (mode !== 'multiple') return new Set(mode === 'none' ? [] : selected)

  if (isAllSelected(selected, ids)) {
    const next = new Set(selected)
    for (const id of ids) next.delete(id)
    return next
  }
  return new Set([...selected, ...ids])
}

/** `false` for an empty `ids` -- "all of nothing" would tick a box over no rows. */
export function isAllSelected(selected: ReadonlySet<RowId>, ids: readonly RowId[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id))
}

/** Drives `aria-checked="mixed"` on the header checkbox. */
export function isIndeterminate(selected: ReadonlySet<RowId>, ids: readonly RowId[]): boolean {
  const hit = ids.some((id) => selected.has(id))
  return hit && !isAllSelected(selected, ids)
}
