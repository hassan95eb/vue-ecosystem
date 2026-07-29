import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HolidayBadge from '../src/components/HolidayBadge.vue'
import RelativeDate from '../src/components/RelativeDate.vue'

describe('HolidayBadge', () => {
  it('renders the holiday title on a holiday date', () => {
    const wrapper = mount(HolidayBadge, { props: { date: { jm: 1, jd: 1 } } })
    expect(wrapper.find('.vet-holiday-badge').exists()).toBe(true)
    expect(wrapper.text()).toBe('نوروز')
    expect(wrapper.find('.vet-holiday-badge').attributes('dir')).toBe('rtl')
  })

  it('renders nothing on a non-holiday date', () => {
    const wrapper = mount(HolidayBadge, { props: { date: { jm: 6, jd: 15 } } })
    expect(wrapper.find('.vet-holiday-badge').exists()).toBe(false)
  })

  it('respects the rtl prop', () => {
    const wrapper = mount(HolidayBadge, { props: { date: { jm: 1, jd: 1 }, rtl: false } })
    expect(wrapper.find('.vet-holiday-badge').attributes('dir')).toBe('ltr')
  })

  it('supports a default slot for custom rendering', () => {
    const wrapper = mount(HolidayBadge, {
      props: { date: { jm: 1, jd: 1 } },
      slots: { default: `<template #default="{ holiday }">🎉 {{ holiday.title }}</template>` },
    })
    expect(wrapper.text()).toBe('🎉 نوروز')
  })
})

describe('RelativeDate', () => {
  const now = new Date(2024, 2, 20) // 1403/01/01

  it('renders the relative phrase and an absolute title/datetime', () => {
    const wrapper = mount(RelativeDate, {
      props: { date: { jy: 1403, jm: 1, jd: 1 }, now },
    })
    expect(wrapper.text()).toBe('امروز')
    expect(wrapper.find('time').attributes('title')).toBe('۱۴۰۳/۰۱/۰۱')
    expect(wrapper.find('time').attributes('datetime')).toBe('2024-03-20')
  })

  it('respects persianDigits and titlePattern', () => {
    const wrapper = mount(RelativeDate, {
      props: {
        date: { jy: 1403, jm: 1, jd: 4 },
        now,
        persianDigits: false,
        titlePattern: 'YYYY-MM-DD',
      },
    })
    expect(wrapper.text()).toBe('3 روز دیگر')
    expect(wrapper.find('time').attributes('title')).toBe('1403-01-04')
  })

  it('supports a scoped slot for custom rendering', () => {
    const wrapper = mount(RelativeDate, {
      props: { date: { jy: 1403, jm: 1, jd: 1 }, now },
      slots: {
        default: `<template #default="{ relative, absolute }">{{ relative }} ({{ absolute }})</template>`,
      },
    })
    expect(wrapper.text()).toBe('امروز (۱۴۰۳/۰۱/۰۱)')
  })
})
