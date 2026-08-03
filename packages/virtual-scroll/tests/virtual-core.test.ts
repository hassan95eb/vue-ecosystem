import { describe, it, expect } from 'vitest'
import {
  computeVirtualRange,
  computeTotalHeight,
  offsetForIndex,
  DEFAULT_OVERSCAN,
} from '../src/internal/virtual-core'

/** 20px rows in a 100px viewport -> exactly 5 rows visible. */
const base = { containerHeight: 100, itemHeight: 20, itemCount: 1000 } as const

/** Returns whatever `fn` threw, or a marker so "did not throw" fails the matcher. */
function captureError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return '<did not throw>'
}

describe('computeVirtualRange', () => {
  it('starts at index 0 with no overscan above', () => {
    const range = computeVirtualRange({ ...base, scrollTop: 0, overscan: 0 })

    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(5)
    expect(range.startOffset).toBe(0)
    expect(range.totalHeight).toBe(20_000)
  })

  it('clamps overscan at the top boundary rather than going negative', () => {
    const range = computeVirtualRange({ ...base, scrollTop: 0, overscan: 4 })

    // Would be -4 without clamping; the 4 rows of overscan below survive.
    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(9)
    expect(range.startOffset).toBe(0)
  })

  it('applies overscan on both sides mid-list', () => {
    const range = computeVirtualRange({ ...base, scrollTop: 1000, overscan: 3 })

    // Visible rows are 50..54; overscan widens to 47..57 inclusive.
    expect(range.startIndex).toBe(47)
    expect(range.endIndex).toBe(58)
    expect(range.startOffset).toBe(940)
  })

  it('defaults overscan to DEFAULT_OVERSCAN', () => {
    const withDefault = computeVirtualRange({ ...base, scrollTop: 1000 })
    const explicit = computeVirtualRange({ ...base, scrollTop: 1000, overscan: DEFAULT_OVERSCAN })

    expect(DEFAULT_OVERSCAN).toBe(4)
    expect(withDefault).toEqual(explicit)
  })

  it('renders a partially scrolled row at both edges', () => {
    // Scrolled half a row: rows 0..5 are all at least partly on screen.
    const range = computeVirtualRange({ ...base, scrollTop: 10, overscan: 0 })

    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(6)
  })

  it('clamps at the bottom boundary and never returns an out-of-range index', () => {
    const range = computeVirtualRange({ ...base, scrollTop: 19_900, overscan: 4 })

    expect(range.endIndex).toBe(base.itemCount)
    expect(range.startIndex).toBe(991)
    expect(range.startIndex).toBeLessThanOrEqual(range.endIndex)
  })

  it('clamps a scrollTop past the end back to the last full screen', () => {
    // A list that shrank while the user was scrolled down. Rendering nothing
    // here would show a blank list, so the window snaps to the tail instead.
    const atMax = computeVirtualRange({ ...base, scrollTop: 19_900, overscan: 0 })
    const wayPast = computeVirtualRange({ ...base, scrollTop: 999_999, overscan: 0 })

    expect(wayPast).toEqual(atMax)
    expect(wayPast.endIndex).toBe(1000)
    expect(wayPast.startIndex).toBe(995)
  })

  it('treats a negative scrollTop as 0 (iOS rubber-banding)', () => {
    const negative = computeVirtualRange({ ...base, scrollTop: -250, overscan: 2 })
    const zero = computeVirtualRange({ ...base, scrollTop: 0, overscan: 2 })

    expect(negative).toEqual(zero)
    expect(negative.startIndex).toBe(0)
  })

  it('returns the whole list when it is shorter than the viewport', () => {
    const range = computeVirtualRange({
      scrollTop: 0,
      containerHeight: 100,
      itemHeight: 20,
      itemCount: 3,
      overscan: 4,
    })

    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(3)
    expect(range.totalHeight).toBe(60)
  })

  it('returns an empty window for an empty list', () => {
    const range = computeVirtualRange({ ...base, itemCount: 0, scrollTop: 0 })

    expect(range).toEqual({ startIndex: 0, endIndex: 0, startOffset: 0, totalHeight: 0 })
  })

  it('survives an unmeasured container (height 0) without collapsing to nothing', () => {
    // Pre-measurement the container reports 0; overscan alone should still
    // produce a first paint rather than an empty list.
    const range = computeVirtualRange({ ...base, containerHeight: 0, scrollTop: 0, overscan: 4 })

    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(4)
  })

  it('never produces a window wider than the list', () => {
    for (const scrollTop of [0, 37, 500, 19_999, 1e9]) {
      const range = computeVirtualRange({ ...base, scrollTop })

      expect(range.startIndex).toBeGreaterThanOrEqual(0)
      expect(range.endIndex).toBeLessThanOrEqual(base.itemCount)
      expect(range.startIndex).toBeLessThanOrEqual(range.endIndex)
    }
  })

  it('rejects a non-positive or non-finite itemHeight', () => {
    for (const itemHeight of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
      const err = captureError(() => computeVirtualRange({ ...base, itemHeight, scrollTop: 0 }))
      expect(err).toBeEcosystemError('virtual-scroll/invalid-item-height')
    }
  })

  it('rejects a negative or fractional overscan', () => {
    for (const overscan of [-1, 1.5]) {
      const err = captureError(() => computeVirtualRange({ ...base, scrollTop: 0, overscan }))
      expect(err).toBeEcosystemError('virtual-scroll/invalid-overscan')
    }
  })
})

describe('computeTotalHeight', () => {
  it('multiplies count by row height', () => {
    expect(computeTotalHeight(1000, 20)).toBe(20_000)
    expect(computeTotalHeight(0, 20)).toBe(0)
  })

  it('floors a fractional count and treats a negative one as empty', () => {
    expect(computeTotalHeight(2.7, 10)).toBe(20)
    expect(computeTotalHeight(-5, 10)).toBe(0)
  })
})

describe('offsetForIndex', () => {
  it('is the running sum of fixed row heights', () => {
    expect(offsetForIndex(0, 32)).toBe(0)
    expect(offsetForIndex(7, 32)).toBe(224)
  })
})
