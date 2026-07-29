import { describe, it, expect } from 'vitest'
import { useDateRangePicker } from '../src/composables/useDateRangePicker'

const d = (jy: number, jm: number, jd: number) => ({ jy, jm, jd })

describe('useDateRangePicker', () => {
  it('opens on today by default, with an empty range', () => {
    const picker = useDateRangePicker()
    expect(picker.isComplete.value).toBe(false)
    expect(picker.start.value).toBeNull()
    expect(picker.end.value).toBeNull()
  })

  it('opens on the given initial view', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 7, 1) })
    expect(picker.viewYear.value).toBe(1403)
    expect(picker.viewMonth.value).toBe(7)
    expect(picker.viewMonthName.value).toBe('مهر')
  })

  it('select() sets the start on the first call and the end on the second', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })

    picker.select(d(1403, 1, 5))
    expect(picker.start.value).toEqual(d(1403, 1, 5))
    expect(picker.end.value).toBeNull()
    expect(picker.isComplete.value).toBe(false)

    picker.select(d(1403, 1, 15))
    expect(picker.start.value).toEqual(d(1403, 1, 5))
    expect(picker.end.value).toEqual(d(1403, 1, 15))
    expect(picker.isComplete.value).toBe(true)
  })

  it('normalises the range when the second click is before the first', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })

    picker.select(d(1403, 1, 20))
    picker.select(d(1403, 1, 10))

    expect(picker.start.value).toEqual(d(1403, 1, 10))
    expect(picker.end.value).toEqual(d(1403, 1, 20))
  })

  it('starts a fresh range after a complete one', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })

    picker.select(d(1403, 1, 5))
    picker.select(d(1403, 1, 15))
    picker.select(d(1403, 1, 8))

    expect(picker.start.value).toEqual(d(1403, 1, 8))
    expect(picker.end.value).toBeNull()
  })

  it('clamps a selection to min/max', () => {
    const picker = useDateRangePicker({
      initialView: d(1403, 1, 1),
      min: d(1403, 1, 5),
      max: d(1403, 1, 25),
    })

    picker.select(d(1403, 1, 1))
    expect(picker.start.value).toEqual(d(1403, 1, 5))
  })

  it('clear() resets both ends', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })
    picker.select(d(1403, 1, 5))
    picker.select(d(1403, 1, 15))
    picker.clear()

    expect(picker.start.value).toBeNull()
    expect(picker.end.value).toBeNull()
  })

  it('goToNextMonth / goToPreviousMonth roll over the year boundary', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 12, 1) })
    picker.goToNextMonth()
    expect(picker.viewYear.value).toBe(1404)
    expect(picker.viewMonth.value).toBe(1)

    picker.goToPreviousMonth()
    expect(picker.viewYear.value).toBe(1403)
    expect(picker.viewMonth.value).toBe(12)
  })

  it('isInRange / isRangeStart / isRangeEnd reflect the current selection', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })
    picker.select(d(1403, 1, 5))
    picker.select(d(1403, 1, 15))

    expect(picker.isRangeStart(d(1403, 1, 5))).toBe(true)
    expect(picker.isRangeEnd(d(1403, 1, 15))).toBe(true)
    expect(picker.isInRange(d(1403, 1, 10))).toBe(true)
    expect(picker.isInRange(d(1403, 1, 20))).toBe(false)
  })

  it('isDisabled reflects min/max bounds', () => {
    const picker = useDateRangePicker({ min: d(1403, 1, 5), max: d(1403, 1, 25) })
    expect(picker.isDisabled(d(1403, 1, 1))).toBe(true)
    expect(picker.isDisabled(d(1403, 1, 10))).toBe(false)
    expect(picker.isDisabled(d(1403, 1, 30))).toBe(true)
  })

  it('formatted reflects the pattern and persianDigits options', () => {
    const picker = useDateRangePicker({
      initialView: d(1403, 1, 1),
      pattern: 'YYYY-MM-DD',
      persianDigits: false,
    })
    picker.select(d(1403, 1, 1))
    picker.select(d(1403, 1, 10))
    expect(picker.formatted.value).toBe('1403-01-01 – 1403-01-10')
  })

  it('viewDays lists every day of the viewed month', () => {
    const picker = useDateRangePicker({ initialView: d(1403, 1, 1) })
    expect(picker.viewDays.value).toHaveLength(31)
  })
})
