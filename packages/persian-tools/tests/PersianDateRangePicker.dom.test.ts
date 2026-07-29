import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PersianDateRangePicker from '../src/components/PersianDateRangePicker.vue'

const d = (jy: number, jm: number, jd: number) => ({ jy, jm, jd })

describe('PersianDateRangePicker', () => {
  it('renders RTL by default and switches with the rtl prop', () => {
    const rtl = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })
    expect(rtl.find('.vet-drp').attributes('dir')).toBe('rtl')

    const ltr = mount(PersianDateRangePicker, {
      props: { initialView: d(1403, 1, 1), rtl: false },
    })
    expect(ltr.find('.vet-drp').attributes('dir')).toBe('ltr')
  })

  it('renders every day of the initial view month as a day cell', () => {
    const wrapper = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })
    // 1403/01 (Farvardin) has 31 days.
    expect(wrapper.findAll('.vet-drp__day')).toHaveLength(31)
  })

  it('selects a start then an end date on click, and emits update:modelValue', async () => {
    const wrapper = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })
    const days = wrapper.findAll('.vet-drp__day')

    await days[4]?.trigger('click') // day 5
    await days[14]?.trigger('click') // day 15

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const last = emitted?.at(-1)?.[0]
    expect(last).toEqual({ start: d(1403, 1, 5), end: d(1403, 1, 15) })
  })

  it('disables days outside min/max', () => {
    const wrapper = mount(PersianDateRangePicker, {
      props: { initialView: d(1403, 1, 1), min: d(1403, 1, 5), max: d(1403, 1, 25) },
    })
    const days = wrapper.findAll('.vet-drp__day')

    expect(days[0]?.attributes('disabled')).toBeDefined() // day 1 < min
    expect(days[9]?.attributes('disabled')).toBeUndefined() // day 10, within bounds
    expect(days[29]?.attributes('disabled')).toBeDefined() // day 30 > max
  })

  it('supports a custom day slot', () => {
    const wrapper = mount(PersianDateRangePicker, {
      props: { initialView: d(1403, 1, 1) },
      slots: {
        day: `<template #day="{ date }"><span class="custom-day">{{ date.jd }}</span></template>`,
      },
    })

    expect(wrapper.findAll('.custom-day')).toHaveLength(31)
    expect(wrapper.find('.vet-drp__day').exists()).toBe(false)
  })

  it('the default header nav buttons move to the previous/next month', async () => {
    const wrapper = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })
    const [previousButton, nextButton] = wrapper.findAll('.vet-drp__nav')

    await nextButton?.trigger('click')
    expect(wrapper.find('.vet-drp__select').element.value).toBe('2') // Ordibehesht

    await previousButton?.trigger('click')
    await previousButton?.trigger('click')
    expect(wrapper.find('.vet-drp__select').element.value).toBe('12') // rolled back into Esfand
    expect(wrapper.findAll('.vet-drp__select')[1]?.element.value).toBe('1402')
  })

  it('the default header month/year selects jump directly to any month or year', async () => {
    const wrapper = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })
    const [monthSelect, yearSelect] = wrapper.findAll('.vet-drp__select')

    await monthSelect?.setValue('7')
    expect(wrapper.findAll('.vet-drp__day')).toHaveLength(30) // Mehr has 30 days

    await yearSelect?.setValue('1404')
    expect(wrapper.findAll('.vet-drp__day')).toHaveLength(30) // 1404/07 also has 30 days
  })

  it('supports a custom header slot', () => {
    const wrapper = mount(PersianDateRangePicker, {
      props: { initialView: d(1403, 7, 1) },
      slots: {
        header: `<template #header="{ viewMonthName }"><h3 class="custom-header">{{ viewMonthName }}</h3></template>`,
      },
    })

    expect(wrapper.find('.custom-header').text()).toBe('مهر')
    expect(wrapper.find('.vet-drp__header').exists()).toBe(false)
  })

  it('exposes clear() and select() for imperative control', async () => {
    const wrapper = mount(PersianDateRangePicker, { props: { initialView: d(1403, 1, 1) } })

    wrapper.vm.select(d(1403, 1, 5))
    wrapper.vm.select(d(1403, 1, 10))
    expect(wrapper.vm.range).toEqual({ start: d(1403, 1, 5), end: d(1403, 1, 10) })

    wrapper.vm.clear()
    expect(wrapper.vm.range).toEqual({ start: null, end: null })
  })
})
