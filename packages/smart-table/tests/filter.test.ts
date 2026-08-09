import { describe, expect, it } from 'vitest'
import { createQuery, defineSchema, emptyQuery } from '@vue-ecosystem/query-builder'
import { deriveSchema, filterRows, matchesGlobalFilter, toQueryRecord } from '../src'
import { columns, ids, tasks } from './fixtures'

const schema = deriveSchema(columns)

describe('toQueryRecord', () => {
  it('keys the record by column id, not by row property', () => {
    const record = toQueryRecord(tasks[0]!, [
      { id: 'label', accessor: (row) => row.title.toUpperCase() },
    ])
    expect(record).toEqual({ label: 'WRITE INVOICE' })
  })

  it('omits columns marked filterable: false, matching the derived schema', () => {
    expect(Object.keys(toQueryRecord(tasks[0]!, columns))).toEqual(Object.keys(schema))
  })
})

describe('matchesGlobalFilter', () => {
  it('matches case-insensitively by default', () => {
    expect(matchesGlobalFilter(tasks[0]!, columns, 'INVOICE')).toBe(true)
    expect(matchesGlobalFilter(tasks[1]!, columns, 'invoice')).toBe(true)
  })

  it('honours caseSensitive', () => {
    // Task 1 is 'Write invoice', task 2 is 'review INVOICE'.
    expect(matchesGlobalFilter(tasks[0]!, columns, 'invoice', true)).toBe(true)
    expect(matchesGlobalFilter(tasks[0]!, columns, 'INVOICE', true)).toBe(false)
    expect(matchesGlobalFilter(tasks[1]!, columns, 'invoice', true)).toBe(false)
  })

  it('matches an empty term', () => {
    expect(matchesGlobalFilter(tasks[2]!, columns, '')).toBe(true)
  })

  it('skips missing values rather than matching "null"', () => {
    expect(matchesGlobalFilter(tasks[2]!, columns, 'null')).toBe(false)
  })

  it('skips columns marked searchable: false', () => {
    const rows = [{ ...tasks[0]!, secret: 'classified' }]
    expect(matchesGlobalFilter(rows[0]!, columns, 'classified')).toBe(false)
  })

  it('stringifies non-strings, so numbers are searchable', () => {
    expect(matchesGlobalFilter(tasks[0]!, columns, '120')).toBe(true)
  })
})

describe('filterRows', () => {
  it('returns a copy when there is nothing to filter', () => {
    const result = filterRows(tasks, columns)
    expect(result).not.toBe(tasks)
    expect(ids(result)).toEqual([1, 2, 3, 4])
  })

  it('treats an empty query group as no filter', () => {
    expect(ids(filterRows(tasks, columns, { query: emptyQuery() }))).toEqual([1, 2, 3, 4])
  })

  it('delegates the structured filter to query-builder evaluate()', () => {
    const query = createQuery(schema).where('status', 'in', ['low', 'medium']).build()
    expect(ids(filterRows(tasks, columns, { query }))).toEqual([2, 3])
  })

  it('inherits evaluate() missing-value semantics: only isNull matches a missing cell', () => {
    const isNull = createQuery(schema).where('total', 'isNull').build()
    const neq = createQuery(schema).where('total', 'neq', 999).build()

    expect(ids(filterRows(tasks, columns, { query: isNull }))).toEqual([3])
    expect(ids(filterRows(tasks, columns, { query: neq }))).not.toContain(3)
  })

  it('passes caseSensitive through to evaluate()', () => {
    const query = createQuery(schema).where('title', 'contains', 'invoice').build()

    expect(ids(filterRows(tasks, columns, { query }))).toEqual([1, 2])
    expect(ids(filterRows(tasks, columns, { query, caseSensitive: true }))).toEqual([1])
  })

  it('ands the two filters together', () => {
    const query = createQuery(schema).where('done', 'eq', true).build()
    expect(ids(filterRows(tasks, columns, { query, globalFilter: 'invoice' }))).toEqual([2])
  })

  it('ignores a whitespace-only global filter', () => {
    expect(ids(filterRows(tasks, columns, { globalFilter: '   ' }))).toEqual([1, 2, 3, 4])
  })

  it('preserves source order rather than imposing one', () => {
    const reversed = [...tasks].reverse()
    expect(ids(filterRows(reversed, columns, { globalFilter: 'i' }))).toEqual([4, 3, 2, 1])
  })

  it('filters on a computed column through its accessor', () => {
    const initials = [{ id: 'initial', accessor: (row: (typeof tasks)[number]) => row.title[0] }]
    const query = createQuery(defineSchema({ initial: { kind: 'string' } }))
      .where('initial', 'eq', 'a')
      .build()

    expect(ids(filterRows(tasks, initials, { query }))).toEqual([3])
  })
})
