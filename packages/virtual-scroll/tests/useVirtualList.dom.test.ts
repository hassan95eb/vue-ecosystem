import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { useVirtualList, type VirtualItem } from '../src'

/**
 * jsdom implements neither `ResizeObserver` nor layout, so a mounted element
 * always reports `clientHeight === 0` and never resizes. Both are stubbed here:
 * the observer records its callbacks so a test can fire a resize by hand, and
 * `clientHeight` / `scrollTop` are redefined as plain writable properties.
 */
const resizeCallbacks = new Set<() => void>()

class StubResizeObserver {
  constructor(private readonly callback: () => void) {}
  observe(): void {
    resizeCallbacks.add(this.callback)
  }
  disconnect(): void {
    resizeCallbacks.delete(this.callback)
  }
  unobserve(): void {
    resizeCallbacks.delete(this.callback)
  }
}

function fireResize(): void {
  for (const cb of resizeCallbacks) cb()
}

function setLayout(el: HTMLElement, { clientHeight = 0, scrollTop = 0 } = {}): void {
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true })
}

const originalResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  resizeCallbacks.clear()
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver
})

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver
  vi.restoreAllMocks()
})

interface Harness {
  readonly items: Ref<string[]>
  readonly seen: { virtualItems: VirtualItem<string>[]; totalHeight: number }
  readonly container: HTMLElement
  readonly unmount: () => void
}

/** Mounts a minimal component around the composable and hands back live state. */
function mountHarness(
  itemCount = 1000,
  options: { itemHeight: number; overscan?: number } = { itemHeight: 20 },
  containerHeight = 100,
): Harness {
  const items = ref(Array.from({ length: itemCount }, (_, i) => `row-${i}`))
  const seen = { virtualItems: [] as VirtualItem<string>[], totalHeight: 0 }

  const Component = defineComponent({
    setup() {
      const { virtualItems, totalHeight, containerRef } = useVirtualList<string>(items, options)
      return () => {
        seen.virtualItems = virtualItems.value
        seen.totalHeight = totalHeight.value
        return h('div', { ref: containerRef }, [
          h(
            'div',
            { style: { height: `${totalHeight.value}px` } },
            virtualItems.value.map((v) => h('div', { key: v.index }, v.item)),
          ),
        ])
      }
    },
  })

  const wrapper = mount(Component, { attachTo: document.body })
  const container = wrapper.element as HTMLElement
  setLayout(container, { clientHeight: containerHeight, scrollTop: 0 })

  return { items, seen, container, unmount: () => wrapper.unmount() }
}

describe('useVirtualList', () => {
  it('renders only the visible window once the container is measured', async () => {
    const { seen, unmount } = mountHarness()

    // Before measurement the container reports 0 -- overscan only.
    expect(seen.virtualItems).toHaveLength(4)

    fireResize()
    await nextTick()

    // 5 visible rows + 4 of overscan below; overscan above is clamped at index 0.
    expect(seen.virtualItems).toHaveLength(9)
    expect(seen.virtualItems[0]).toEqual({ index: 0, item: 'row-0', offsetTop: 0 })
    expect(seen.virtualItems.at(-1)).toEqual({ index: 8, item: 'row-8', offsetTop: 160 })

    unmount()
  })

  it('exposes the full list height for the spacer, not the rendered height', async () => {
    const { seen, unmount } = mountHarness(1000, { itemHeight: 20 })

    fireResize()
    await nextTick()

    expect(seen.totalHeight).toBe(20_000)
    expect(seen.virtualItems.length).toBeLessThan(20)

    unmount()
  })

  it('moves the window as the container scrolls', async () => {
    const { seen, container, unmount } = mountHarness()

    fireResize()
    await nextTick()

    container.scrollTop = 1000
    container.dispatchEvent(new Event('scroll'))
    await nextTick()

    // Visible rows 50..54, widened by the default overscan of 4 to 46..58.
    expect(seen.virtualItems[0]).toEqual({ index: 46, item: 'row-46', offsetTop: 920 })
    expect(seen.virtualItems.at(-1)?.index).toBe(58)

    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(seen.virtualItems[0]?.index).toBe(0)

    unmount()
  })

  it('clamps the window at the end of the list', async () => {
    const { seen, container, unmount } = mountHarness()

    fireResize()
    await nextTick()

    container.scrollTop = 19_900
    container.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(seen.virtualItems.at(-1)).toEqual({
      index: 999,
      item: 'row-999',
      offsetTop: 19_980,
    })

    unmount()
  })

  it('reacts to the item list changing length', async () => {
    const { items, seen, container, unmount } = mountHarness()

    fireResize()
    await nextTick()

    container.scrollTop = 1000
    container.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(seen.virtualItems[0]?.index).toBe(46)

    // Shrink the list out from under a scrolled-down viewport. The stored
    // scrollTop (1000) is now past the end, so the window snaps to the tail of
    // the shorter list -- rows 5..9 visible, widened by overscan to 1..9 --
    // rather than rendering nothing.
    items.value = items.value.slice(0, 10)
    await nextTick()

    expect(seen.totalHeight).toBe(200)
    expect(seen.virtualItems[0]?.index).toBe(1)
    expect(seen.virtualItems.at(-1)?.index).toBe(9)

    // And growing it again widens the window back out.
    items.value = Array.from({ length: 500 }, (_, i) => `row-${i}`)
    await nextTick()

    expect(seen.totalHeight).toBe(10_000)
    expect(seen.virtualItems.length).toBeGreaterThan(4)

    unmount()
  })

  it('reacts to the container being resized', async () => {
    const { seen, container, unmount } = mountHarness()

    fireResize()
    await nextTick()
    const before = seen.virtualItems.length

    setLayout(container, { clientHeight: 400, scrollTop: 0 })
    fireResize()
    await nextTick()

    // 20 visible rows now instead of 5, plus the same overscan.
    expect(seen.virtualItems).toHaveLength(24)
    expect(seen.virtualItems.length).toBeGreaterThan(before)

    unmount()
  })

  it('honours an explicit overscan of 0', async () => {
    const { seen, container, unmount } = mountHarness(1000, { itemHeight: 20, overscan: 0 })

    fireResize()
    await nextTick()

    container.scrollTop = 1000
    container.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(seen.virtualItems).toHaveLength(5)
    expect(seen.virtualItems[0]?.index).toBe(50)

    unmount()
  })

  it('detaches its scroll listener on unmount', async () => {
    const { container, unmount } = mountHarness()

    fireResize()
    await nextTick()

    const removeSpy = vi.spyOn(container, 'removeEventListener')
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(resizeCallbacks.size).toBe(0)
  })

  it('accepts a getter as well as a ref', async () => {
    const source = ref(['a', 'b', 'c'])
    const Component = defineComponent({
      setup() {
        const { virtualItems, containerRef } = useVirtualList(() => source.value, {
          itemHeight: 20,
        })
        return () =>
          h(
            'div',
            { ref: containerRef },
            virtualItems.value.map((v) => h('div', v.item)),
          )
      },
    })

    const wrapper = mount(Component, { attachTo: document.body })
    setLayout(wrapper.element as HTMLElement, { clientHeight: 100 })
    fireResize()
    await nextTick()

    expect(wrapper.text()).toBe('abc')
    wrapper.unmount()
  })

  it('falls back to the full, unvirtualised list when ResizeObserver is missing', () => {
    // Stands in for SSR, where neither `window` nor `ResizeObserver` exists.
    // Returning an empty range here would ship a blank list to the crawler.
    // @ts-expect-error -- deliberately removing a global the composable probes for
    delete globalThis.ResizeObserver

    const { virtualItems, totalHeight } = useVirtualList(
      Array.from({ length: 1000 }, (_, i) => `row-${i}`),
      { itemHeight: 20 },
    )

    expect(virtualItems.value).toHaveLength(1000)
    expect(virtualItems.value[0]).toEqual({ index: 0, item: 'row-0', offsetTop: 0 })
    expect(virtualItems.value.at(-1)).toEqual({ index: 999, item: 'row-999', offsetTop: 19_980 })
    expect(totalHeight.value).toBe(20_000)
  })

  it('rejects an invalid itemHeight at the call site', () => {
    let captured: unknown = '<did not throw>'
    try {
      useVirtualList([], { itemHeight: 0 })
    } catch (err) {
      captured = err
    }

    expect(captured).toBeEcosystemError('virtual-scroll/invalid-item-height')
  })
})
