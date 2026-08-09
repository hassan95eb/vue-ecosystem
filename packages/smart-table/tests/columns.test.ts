import { describe, expect, it } from 'vitest'
import { columnKind, defineColumns, deriveSchema, getCellValue } from '../src'
import { captureError, columns, tasks } from './fixtures'

describe('defineColumns', () => {
  it('returns the columns unchanged', () => {
    const defs = defineColumns<{ a: string }>()([{ id: 'a' }])
    expect(defs).toEqual([{ id: 'a' }])
  })

  it('rejects a duplicate id', () => {
    expect(
      captureError(() => defineColumns<{ a: string }>()([{ id: 'a' }, { id: 'a' }])),
    ).toBeEcosystemError('smart-table/duplicate-column-id')
  })

  it('rejects an empty id', () => {
    expect(captureError(() => defineColumns<{ a: string }>()([{ id: '' }]))).toBeEcosystemError(
      'smart-table/invalid-column-id',
    )
  })

  it('rejects an enum column with no values', () => {
    expect(
      captureError(() => defineColumns<{ a: string }>()([{ id: 'a', kind: 'enum', values: [] }])),
    ).toBeEcosystemError('smart-table/invalid-enum-column')
  })
})

describe('columnKind', () => {
  it('defaults to string', () => {
    expect(columnKind({ id: 'a' })).toBe('string')
    expect(columnKind({ id: 'a', kind: 'number' })).toBe('number')
  })
})

describe('getCellValue', () => {
  it('reads the property named by the id when there is no accessor', () => {
    expect(getCellValue({ id: 'title' }, tasks[0]!)).toBe('Write invoice')
  })

  it('prefers the accessor', () => {
    expect(getCellValue({ id: 'title', accessor: (row) => row.id }, tasks[0]!)).toBe(1)
  })

  it('returns undefined for a column no row property matches', () => {
    expect(getCellValue({ id: 'nope' }, tasks[0]!)).toBeUndefined()
  })
})

describe('deriveSchema', () => {
  const schema = deriveSchema(columns)

  it('maps each column kind to the matching field kind', () => {
    expect(schema.title).toEqual({ kind: 'string', label: undefined })
    expect(schema.total).toEqual({ kind: 'number', label: undefined })
    expect(schema.dueAt).toEqual({ kind: 'date', label: undefined })
  })

  it('carries the enum values through', () => {
    expect(schema.status).toEqual({
      kind: 'enum',
      values: ['low', 'medium', 'high'],
      label: undefined,
    })
  })

  it('omits columns marked filterable: false', () => {
    expect(Object.keys(schema)).not.toContain('secret')
  })

  it('uses the header as the field label when present', () => {
    const withHeader = deriveSchema([{ id: 'a', header: 'Column A' }])
    expect(withHeader.a).toEqual({ kind: 'string', label: 'Column A' })
  })
})
