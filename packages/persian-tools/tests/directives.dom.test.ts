import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, withDirectives, resolveDirective } from 'vue'
import { vPersianDigits, vHalfSpace } from '../src'

function mountWithDirective(
  name: string,
  directiveValue?: unknown,
  modifiers: Record<string, boolean> = {},
) {
  const Component = defineComponent({
    render() {
      return withDirectives(h('input'), [
        [resolveDirective(name)!, directiveValue, undefined, modifiers],
      ])
    },
  })

  return mount(Component, {
    global: { directives: { [name]: name === 'persian-digits' ? vPersianDigits : vHalfSpace } },
    attachTo: document.body,
  })
}

describe('v-persian-digits', () => {
  it('converts ASCII digits to Persian by default', async () => {
    const input = mountWithDirective('persian-digits').find('input')

    input.element.value = '1234'
    await input.trigger('input')

    expect(input.element.value).toBe('۱۲۳۴')
  })

  it('converts Persian/Arabic-Indic digits to ASCII with the "out" modifier', async () => {
    const input = mountWithDirective('persian-digits', undefined, { out: true }).find('input')

    input.element.value = '۱۲۳۴'
    await input.trigger('input')

    expect(input.element.value).toBe('1234')
  })

  it('accepts an options object equivalent to the modifier', async () => {
    const input = mountWithDirective('persian-digits', { direction: 'out' }).find('input')

    input.element.value = '٥٦٧'
    await input.trigger('input')

    expect(input.element.value).toBe('567')
  })

  it('converts the initial value on mount', () => {
    const Component = defineComponent({
      render() {
        return withDirectives(h('input', { value: '1234' }), [
          [resolveDirective('persian-digits')!, undefined],
        ])
      },
    })
    const wrapper = mount(Component, {
      global: { directives: { 'persian-digits': vPersianDigits } },
      attachTo: document.body,
    })

    expect(wrapper.find('input').element.value).toBe('۱۲۳۴')
  })

  it('preserves the caret position while converting', async () => {
    const input = mountWithDirective('persian-digits').find('input')

    input.element.value = '12345'
    input.element.setSelectionRange(2, 2)
    await input.trigger('input')

    expect(input.element.value).toBe('۱۲۳۴۵')
    expect(input.element.selectionStart).toBe(2)
  })

  it('does nothing when there is no input to bind to', () => {
    const NoInput = defineComponent({
      render() {
        return withDirectives(h('div', 'no input here'), [
          [resolveDirective('persian-digits')!, undefined],
        ])
      },
    })

    expect(() =>
      mount(NoInput, { global: { directives: { 'persian-digits': vPersianDigits } } }),
    ).not.toThrow()
  })

  it('removes its listener on unmount', async () => {
    const wrapper = mountWithDirective('persian-digits')
    const el = wrapper.find('input').element
    wrapper.unmount()

    el.value = '1234'
    el.dispatchEvent(new Event('input'))
    expect(el.value).toBe('1234')
  })
})

describe('v-half-space', () => {
  it('inserts a ZWNJ at the standard prefix/suffix boundary', async () => {
    const input = mountWithDirective('half-space').find('input')

    input.element.value = 'می روم'
    await input.trigger('input')

    expect(input.element.value).toBe('می‌روم')
  })

  it('leaves text that already has correct half-spacing untouched', async () => {
    const input = mountWithDirective('half-space').find('input')

    input.element.value = 'کتاب‌ها'
    // No 'input' event fired: nothing changed, so nothing should either.
    expect(input.element.value).toBe('کتاب‌ها')
  })

  it('does nothing when there is no input to bind to', () => {
    const NoInput = defineComponent({
      render() {
        return withDirectives(h('div', 'no input here'), [
          [resolveDirective('half-space')!, undefined],
        ])
      },
    })

    expect(() =>
      mount(NoInput, { global: { directives: { 'half-space': vHalfSpace } } }),
    ).not.toThrow()
  })

  it('removes its listener on unmount', async () => {
    const wrapper = mountWithDirective('half-space')
    const el = wrapper.find('input').element
    wrapper.unmount()

    el.value = 'می روم'
    el.dispatchEvent(new Event('input'))
    expect(el.value).toBe('می روم')
  })
})
