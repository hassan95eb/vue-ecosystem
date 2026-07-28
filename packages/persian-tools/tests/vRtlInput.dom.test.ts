import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, h, withDirectives, resolveDirective } from 'vue'
import { vRtlInput } from '../src'

function mountInput(directiveValue?: unknown, modifiers: Record<string, boolean> = {}) {
  const Component = defineComponent({
    setup() {
      const model = ref('')
      return { model }
    },
    render() {
      return withDirectives(h('input', { value: this.model }), [
        [resolveDirective('rtl-input')!, directiveValue, undefined, modifiers],
      ])
    },
  })

  return mount(Component, {
    global: { directives: { 'rtl-input': vRtlInput } },
    attachTo: document.body,
  })
}

describe('v-rtl-input', () => {
  it('makes a plain input RTL and right-aligned', () => {
    const input = mountInput().find('input')

    expect(input.attributes('dir')).toBe('rtl')
    expect(input.element.style.textAlign).toBe('right')
  })

  it('keeps a numeric field LTR but right-aligned', () => {
    const input = mountInput({ numeric: true }).find('input')

    expect(input.attributes('dir')).toBe('ltr')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.element.style.textAlign).toBe('right')
  })

  it('normalises Persian digits to ASCII with digits: "english"', async () => {
    const wrapper = mountInput({ digits: 'english' })
    const input = wrapper.find('input')

    input.element.value = '۱۲۳۴'
    await input.trigger('input')

    expect(input.element.value).toBe('1234')
  })

  it('renders ASCII digits as Persian with digits: "persian"', async () => {
    const wrapper = mountInput({ digits: 'persian' })
    const input = wrapper.find('input')

    input.element.value = '1234'
    await input.trigger('input')

    expect(input.element.value).toBe('۱۲۳۴')
  })

  it('leaves digits untouched by default', async () => {
    const wrapper = mountInput()
    const input = wrapper.find('input')

    input.element.value = '۱۲۳۴'
    await input.trigger('input')

    expect(input.element.value).toBe('۱۲۳۴')
  })

  it('reads modifiers as well as an options object', async () => {
    const wrapper = mountInput(undefined, { numeric: true, english: true })
    const input = wrapper.find('input')

    expect(input.attributes('dir')).toBe('ltr')
    input.element.value = '۵۶۷'
    await input.trigger('input')
    expect(input.element.value).toBe('567')
  })

  it('preserves the caret position while converting', async () => {
    const wrapper = mountInput({ digits: 'english' })
    const input = wrapper.find('input')

    input.element.value = '۱۲۳۴۵'
    input.element.setSelectionRange(2, 2)
    await input.trigger('input')

    expect(input.element.value).toBe('12345')
    expect(input.element.selectionStart).toBe(2)
  })

  it('binds to the first nested input when placed on a wrapper', () => {
    const Wrapper = defineComponent({
      render() {
        return withDirectives(h('div', {}, [h('label', 'مبلغ'), h('input')]), [
          [resolveDirective('rtl-input')!, { numeric: true }],
        ])
      },
    })
    const wrapper = mount(Wrapper, {
      global: { directives: { 'rtl-input': vRtlInput } },
      attachTo: document.body,
    })

    expect(wrapper.find('input').attributes('dir')).toBe('ltr')
  })

  it('does nothing when there is no input to bind to', () => {
    const NoInput = defineComponent({
      render() {
        return withDirectives(h('div', 'no input here'), [
          [resolveDirective('rtl-input')!, undefined],
        ])
      },
    })

    expect(() =>
      mount(NoInput, { global: { directives: { 'rtl-input': vRtlInput } } }),
    ).not.toThrow()
  })

  it('removes its listener on unmount', async () => {
    const wrapper = mountInput({ digits: 'english' })
    const el = wrapper.find('input').element
    wrapper.unmount()

    el.value = '۱۲۳'
    el.dispatchEvent(new Event('input'))
    expect(el.value).toBe('۱۲۳')
  })
})
