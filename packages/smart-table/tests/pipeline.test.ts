import { describe, expect, it } from 'vitest'
import { createQuery } from '@vue-ecosystem/query-builder'
import { deriveSchema, runPipeline, type TableState } from '../src'
import { columns, ids, tasks } from './fixtures'

const schema = deriveSchema(columns)

const state = (overrides: Partial<TableState> = {}): TableState => ({
  sort: [],
  query: null,
  globalFilter: '',
  pageIndex: 0,
  pageSize: null,
  ...overrides,
})

const options = { locale: 'en' } as const

describe('runPipeline', () => {
  it('renders every row when unpaginated', () => {
    const result = runPipeline(tasks, columns, state(), options)

    expect(ids(result.rows)).toEqual([1, 2, 3, 4])
    expect(result.pageCount).toBe(1)
    expect(result.pageIndex).toBe(0)
  })

  it('filters before sorting, not after', () => {
    // If it sorted first and filtered second the result would be identical, so
    // the observable claim is the cheaper one: `filtered` is in source order and
    // `sorted` is not.
    const result = runPipeline(
      tasks,
      columns,
      state({ globalFilter: 'i', sort: [{ columnId: 'title', direction: 'desc' }] }),
      options,
    )

    expect(ids(result.filtered)).toEqual([1, 2, 3, 4])
    expect(ids(result.sorted)).not.toEqual([1, 2, 3, 4])
  })

  it('sorts before paginating, so page 2 continues page 1', () => {
    const first = runPipeline(
      tasks,
      columns,
      state({ sort: [{ columnId: 'total', direction: 'asc' }], pageSize: 2, pageIndex: 0 }),
      options,
    )
    const second = runPipeline(
      tasks,
      columns,
      state({ sort: [{ columnId: 'total', direction: 'asc' }], pageSize: 2, pageIndex: 1 }),
      options,
    )

    expect(ids(first.rows)).toEqual([2, 1])
    expect(ids(second.rows)).toEqual([4, 3])
  })

  it('clamps the page index against the filtered count, not the total', () => {
    const result = runPipeline(
      tasks,
      columns,
      state({ globalFilter: 'Archive', pageSize: 2, pageIndex: 9 }),
      options,
    )

    expect(result.pageCount).toBe(1)
    expect(result.pageIndex).toBe(0)
    expect(ids(result.rows)).toEqual([3])
  })

  it('reports the filtered count independently of the page', () => {
    const result = runPipeline(tasks, columns, state({ pageSize: 2 }), options)

    expect(result.filtered).toHaveLength(4)
    expect(result.rows).toHaveLength(2)
  })

  it('combines the structured filter, the sort and the page', () => {
    const query = createQuery(schema).where('done', 'eq', false).build()
    const result = runPipeline(
      tasks,
      columns,
      state({ query, sort: [{ columnId: 'title', direction: 'asc' }], pageSize: 1, pageIndex: 1 }),
      options,
    )

    expect(ids(result.filtered)).toEqual([1, 3])
    expect(ids(result.sorted)).toEqual([3, 1])
    expect(ids(result.rows)).toEqual([1])
    expect(result.pageCount).toBe(2)
  })

  it('never mutates the source array', () => {
    const source = [...tasks]
    runPipeline(
      source,
      columns,
      state({ sort: [{ columnId: 'title', direction: 'desc' }] }),
      options,
    )
    expect(ids(source)).toEqual([1, 2, 3, 4])
  })
})
