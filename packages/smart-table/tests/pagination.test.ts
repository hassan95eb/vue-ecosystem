import { describe, expect, it } from 'vitest'
import { clampPageIndex, pageCountFor, paginateRows, DEFAULT_PAGE_SIZE } from '../src'
import { captureError } from './fixtures'
import { assertValidPageSize } from '../src/internal/pagination'

describe('assertValidPageSize', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (size) => {
    expect(captureError(() => assertValidPageSize(size))).toBeEcosystemError(
      'smart-table/invalid-page-size',
    )
  })

  it('accepts a positive integer', () => {
    expect(captureError(() => assertValidPageSize(DEFAULT_PAGE_SIZE))).toBeUndefined()
  })
})

describe('pageCountFor', () => {
  it('is at least 1, even with no rows', () => {
    expect(pageCountFor(0, 10)).toBe(1)
  })

  it('rounds up a partial last page', () => {
    expect(pageCountFor(21, 10)).toBe(3)
    expect(pageCountFor(20, 10)).toBe(2)
  })
})

describe('clampPageIndex', () => {
  it('clamps into range', () => {
    expect(clampPageIndex(-3, 5)).toBe(0)
    expect(clampPageIndex(9, 5)).toBe(4)
    expect(clampPageIndex(2, 5)).toBe(2)
  })

  it('collapses non-finite input to 0', () => {
    expect(clampPageIndex(Number.NaN, 5)).toBe(0)
    expect(clampPageIndex(Number.POSITIVE_INFINITY, 5)).toBe(0)
  })

  it('truncates a fractional index', () => {
    expect(clampPageIndex(2.9, 5)).toBe(2)
  })
})

describe('paginateRows', () => {
  const rows = [1, 2, 3, 4, 5]

  it('slices the requested page', () => {
    expect(paginateRows(rows, 0, 2)).toEqual([1, 2])
    expect(paginateRows(rows, 2, 2)).toEqual([5])
  })

  it('returns an empty page past the end rather than throwing', () => {
    expect(paginateRows(rows, 9, 2)).toEqual([])
  })

  it('does not mutate its input', () => {
    paginateRows(rows, 1, 2)
    expect(rows).toEqual([1, 2, 3, 4, 5])
  })
})
