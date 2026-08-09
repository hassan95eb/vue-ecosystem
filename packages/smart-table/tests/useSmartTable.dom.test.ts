import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { createQuery } from '@vue-ecosystem/query-builder'
import { useSmartTable, type UseSmartTableOptions, type UseSmartTableReturn } from '../src'
import { captureError, columns, tasks, type Task } from './fixtures'

/**
 * The composable needs a reactive scope but not a component: it renders
 * nothing. Running it inside an `effectScope` exercises the real watchers and
 * computeds while keeping the tests about behaviour rather than markup -- and
 * disposing the scope proves nothing leaks.
 */
let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

type Columns = typeof columns

function setup(
  rows = tasks,
  options: Partial<UseSmartTableOptions<Task, Columns>> = {},
): {
  table: UseSmartTableReturn<Task, Columns>
  source: ReturnType<typeof ref<Task[]>>
} {
  const source = ref<Task[]>([...rows])
  const table = scope.run(() =>
    useSmartTable(source as unknown as Task[] | (() => Task[]), {
      columns,
      locale: 'en',
      ...options,
    }),
  )
  if (table === undefined) throw new Error('effect scope was already stopped')
  return { table, source }
}

const rowIds = (table: UseSmartTableReturn<Task, Columns>): number[] =>
  table.rows.value.map((row) => row.row.id)

describe('useSmartTable', () => {
  it('validates its options synchronously', () => {
    expect(
      captureError(() => useSmartTable<Task, Columns>([], { columns, pageSize: 0 })),
    ).toBeEcosystemError('smart-table/invalid-page-size')
  })

  it('exposes a schema ready for useQueryBuilder', () => {
    const { table } = setup()
    expect(Object.keys(table.schema)).toContain('status')
    expect(Object.keys(table.schema)).not.toContain('secret')
  })

  it('renders every row when unpaginated', () => {
    const { table } = setup()
    expect(rowIds(table)).toEqual([1, 2, 3, 4])
    expect(table.pageCount.value).toBe(1)
  })

  it('tracks a reactive source', async () => {
    const { table, source } = setup()
    source.value = [tasks[0]!]
    await nextTick()

    expect(rowIds(table)).toEqual([1])
    expect(table.totalCount.value).toBe(1)
  })

  it('cycles sort state from a header click', () => {
    const { table } = setup()

    table.toggleSort('total')
    expect(table.directionFor('total')).toBe('asc')
    expect(rowIds(table)).toEqual([2, 1, 4, 3])

    table.toggleSort('total')
    expect(table.directionFor('total')).toBe('desc')

    table.toggleSort('total')
    expect(table.directionFor('total')).toBeNull()
    expect(rowIds(table)).toEqual([1, 2, 3, 4])
  })

  it('reports multi-sort priority for the header badge', () => {
    const { table } = setup()
    table.toggleSort('done', { multi: true })
    table.toggleSort('total', { multi: true })

    expect(table.priorityFor('done')).toBe(1)
    expect(table.priorityFor('total')).toBe(2)
  })

  it('accepts sort state set wholesale, and clears it', () => {
    const { table } = setup()
    table.setSort([{ columnId: 'title', direction: 'desc' }])
    expect(rowIds(table)).toEqual([1, 4, 2, 3])

    table.clearSort()
    expect(table.sort.value).toEqual([])
    expect(rowIds(table)).toEqual([1, 2, 3, 4])
  })

  it('applies the structured filter', () => {
    const { table } = setup()
    table.query.value = createQuery(table.schema).where('status', 'eq', 'low').build()

    expect(rowIds(table)).toEqual([2])
    expect(table.filteredCount.value).toBe(1)
    expect(table.totalCount.value).toBe(4)
  })

  it('applies the global filter', () => {
    const { table } = setup()
    table.globalFilter.value = 'invoice'
    expect(rowIds(table)).toEqual([1, 2])
  })

  describe('pagination', () => {
    it('slices the current page and clamps a request past the end', () => {
      const { table } = setup(tasks, { pageSize: 2 })

      expect(rowIds(table)).toEqual([1, 2])
      expect(table.pageCount.value).toBe(2)
      expect(table.hasPreviousPage.value).toBe(false)

      table.nextPage()
      expect(rowIds(table)).toEqual([3, 4])
      expect(table.hasNextPage.value).toBe(false)

      table.pageIndex.value = 99
      expect(table.pageIndex.value).toBe(1)

      table.previousPage()
      expect(table.pageIndex.value).toBe(0)

      table.previousPage()
      expect(table.pageIndex.value).toBe(0)
    })

    it('returns to page 1 when the filter changes', async () => {
      const { table } = setup(tasks, { pageSize: 2 })
      table.nextPage()
      expect(table.pageIndex.value).toBe(1)

      table.globalFilter.value = 'i'
      await nextTick()

      expect(table.pageIndex.value).toBe(0)
    })

    it('honours a page size changed at runtime', () => {
      const { table } = setup(tasks, { pageSize: 2 })
      table.pageSize.value = 4
      expect(rowIds(table)).toEqual([1, 2, 3, 4])
      expect(table.pageCount.value).toBe(1)
    })
  })

  describe('selection', () => {
    it('is inert unless a mode is given', () => {
      const { table } = setup()
      table.toggleRow(1)
      expect([...table.selectedIds.value]).toEqual([])
    })

    it('marks the row objects it returns', () => {
      const { table } = setup(tasks, { selection: 'multiple' })
      table.toggleRow(2)

      expect(table.rows.value.map((row) => row.selected)).toEqual([false, true, false, false])
    })

    it('survives sorting and filtering, which an index-keyed selection would not', async () => {
      const { table } = setup(tasks, { selection: 'multiple' })
      table.toggleRow(2)
      table.toggleSort('total')
      table.globalFilter.value = 'invoice'
      await nextTick()

      expect(table.selectedRows.value.map((row) => row.id)).toEqual([2])
    })

    it('selects the filtered set, not the visible page', () => {
      const { table } = setup(tasks, { selection: 'multiple', pageSize: 2 })
      table.toggleAllRows()

      expect(table.selectedIds.value.size).toBe(4)
      expect(table.isAllSelected.value).toBe(true)
      expect(table.isIndeterminate.value).toBe(false)
    })

    it('reports the mixed state for the header checkbox', () => {
      const { table } = setup(tasks, { selection: 'multiple' })
      table.toggleRow(1)

      expect(table.isIndeterminate.value).toBe(true)
      expect(table.isAllSelected.value).toBe(false)
    })

    it('keeps at most one row in single mode', () => {
      const { table } = setup(tasks, { selection: 'single' })
      table.toggleRow(1)
      table.toggleRow(2)

      expect([...table.selectedIds.value]).toEqual([2])
    })

    it('sets a row state directly rather than flipping it', () => {
      const { table } = setup(tasks, { selection: 'multiple' })
      table.setRowSelected(1, true)
      table.setRowSelected(1, true)
      expect([...table.selectedIds.value]).toEqual([1])
      expect(table.isSelected(1)).toBe(true)

      table.setRowSelected(1, false)
      expect(table.isSelected(1)).toBe(false)
    })

    it('clears', () => {
      const { table } = setup(tasks, { selection: 'multiple' })
      table.toggleRow(1)
      table.clearSelection()
      expect(table.selectedIds.value.size).toBe(0)
    })

    it('throws eagerly when a row has no id', () => {
      const rows = [{ ...tasks[0]!, id: undefined as unknown as number }]
      const { table } = setup(rows, { selection: 'multiple' })

      expect(captureError(() => table.rows.value)).toBeEcosystemError('smart-table/missing-row-id')
    })
  })

  describe('virtualisation', () => {
    it('is null unless asked for', () => {
      const { table } = setup()
      expect(table.virtual).toBeNull()
    })

    it('windows the current page when asked for', () => {
      const { table } = setup(tasks, { virtual: { itemHeight: 20 } })

      expect(table.virtual).not.toBeNull()
      expect(table.virtual?.totalHeight.value).toBe(80)
      // jsdom has no layout and no ResizeObserver stub here, so the composable
      // falls back to rendering the full list -- which is the documented SSR /
      // no-measurement behaviour, and exactly what we want to assert stays true.
      expect(table.virtual?.virtualItems.value.map((item) => item.item.row.id)).toEqual([
        1, 2, 3, 4,
      ])
    })
  })
})
