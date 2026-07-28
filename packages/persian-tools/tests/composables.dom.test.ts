import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import { useJalali, usePersianNumber } from '../src'

describe('useJalali', () => {
  it('exposes the parts of a Date', () => {
    const { year, month, day, monthName, formatted } = useJalali(new Date(2024, 2, 20))

    expect(year.value).toBe(1403)
    expect(month.value).toBe(1)
    expect(day.value).toBe(1)
    expect(monthName.value).toBe('فروردین')
    expect(formatted.value).toBe('۱۴۰۳/۰۱/۰۱')
  })

  it('reacts to a changing ref', () => {
    const source = ref(new Date(2024, 2, 20))
    const { formatted } = useJalali(source, { persianDigits: false })

    expect(formatted.value).toBe('1403/01/01')
    source.value = new Date(2025, 2, 21)
    expect(formatted.value).toBe('1404/01/01')
  })

  it('reacts to a changing pattern', () => {
    const pattern = ref('YYYY/MM/DD')
    const { formatted } = useJalali(new Date(2024, 2, 20), { pattern, persianDigits: false })

    expect(formatted.value).toBe('1403/01/01')
    pattern.value = 'D MMMM YYYY'
    expect(formatted.value).toBe('1 فروردین 1403')
  })

  it('accepts a getter, Jalali parts, a Jalali string and a timestamp', () => {
    expect(useJalali(() => new Date(2024, 2, 20)).year.value).toBe(1403)
    expect(useJalali({ jy: 1403, jm: 7, jd: 15 }).monthName.value).toBe('مهر')
    expect(useJalali('1403/07/15').day.value).toBe(15)
    expect(useJalali(new Date(2024, 2, 20).getTime()).year.value).toBe(1403)
  })

  it('exposes calendar metadata', () => {
    const j = useJalali({ jy: 1403, jm: 12, jd: 1 })

    expect(j.isLeapYear.value).toBe(true)
    expect(j.daysInMonth.value).toBe(30)
    expect(j.dayOfYear.value).toBe(337)
    expect(j.weekdayName.value).toBeTypeOf('string')
  })

  it('converts back to a Gregorian Date', () => {
    const { gregorian } = useJalali({ jy: 1403, jm: 1, jd: 1 })
    expect(gregorian.value.getFullYear()).toBe(2024)
    expect(gregorian.value.getMonth()).toBe(2)
    expect(gregorian.value.getDate()).toBe(20)
  })

  it('formats ad hoc and does arithmetic without mutating the source', () => {
    const j = useJalali({ jy: 1403, jm: 1, jd: 1 })

    expect(j.format('YY-MM-DD')).toBe('۰۳-۰۱-۰۱')
    expect(j.addDays(30)).toEqual({ jy: 1403, jm: 1, jd: 31 })
    expect(j.addMonths(1)).toEqual({ jy: 1403, jm: 2, jd: 1 })
    expect(j.parts.value).toEqual({ jy: 1403, jm: 1, jd: 1 })
  })

  it('throws lazily, on access, for an invalid date', () => {
    const j = useJalali({ jy: 1404, jm: 12, jd: 30 })
    expect(() => j.year.value).toThrowError()
  })
})

describe('usePersianNumber', () => {
  it('formats a number', () => {
    const { formatted, currency, english, persian, value } = usePersianNumber(1234567)

    expect(formatted.value).toBe('۱٬۲۳۴٬۵۶۷')
    expect(currency.value).toBe('۱٬۲۳۴٬۵۶۷ تومان')
    expect(english.value).toBe('1234567')
    expect(persian.value).toBe('۱۲۳۴۵۶۷')
    expect(value.value).toBe(1234567)
  })

  it('reacts to a changing source', () => {
    const amount = ref(1000)
    const { formatted } = usePersianNumber(amount, { persianDigits: false })

    expect(formatted.value).toBe('1,000')
    amount.value = 25_000
    expect(formatted.value).toBe('25,000')
  })

  it('accepts a computed source and a Persian-digit string', () => {
    const raw = ref('۱۲۳۴')
    const doubled = computed(() => raw.value)
    expect(usePersianNumber(doubled).value.value).toBe(1234)
  })

  it('switches currency reactively', () => {
    const currencyRef = ref<'toman' | 'rial'>('toman')
    const { currency } = usePersianNumber(1000, { currency: currencyRef })

    expect(currency.value).toBe('۱٬۰۰۰ تومان')
    currencyRef.value = 'rial'
    expect(currency.value).toBe('۱٬۰۰۰ ریال')
  })

  it('honours decimals', () => {
    const { formatted } = usePersianNumber(1234.5, { decimals: 2, persianDigits: false })
    expect(formatted.value).toBe('1,234.50')
  })
})
