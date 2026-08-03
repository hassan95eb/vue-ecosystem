import { computed, ref, shallowRef, toValue, watch, type ComputedRef, type Ref } from 'vue'
import { createLogger, type MaybeRefOrGetter } from '@vue-ecosystem/core'
import {
  assertValidWindowOptions,
  computeTotalHeight,
  computeVirtualRange,
  offsetForIndex,
  DEFAULT_OVERSCAN,
} from '../internal/virtual-core'

const logger = createLogger('virtual-scroll').extend('useVirtualList')

export interface UseVirtualListOptions {
  /**
   * Fixed height of every row, in pixels. Must be finite and greater than 0.
   *
   * Fixed heights only in this pass -- measured / variable heights are tracked
   * in the package README's roadmap.
   */
  readonly itemHeight: number
  /** Rows rendered beyond each edge of the viewport. Defaults to {@link DEFAULT_OVERSCAN} (4). */
  readonly overscan?: number
}

export interface VirtualItem<T> {
  /** Index of this item in the *source* list, not in the rendered window. */
  readonly index: number
  readonly item: T
  /** Pixel offset from the top of the list. Use it to position the row absolutely. */
  readonly offsetTop: number
}

export interface UseVirtualListReturn<T> {
  /** The rows to actually render, in source order. */
  readonly virtualItems: ComputedRef<VirtualItem<T>[]>
  /** Height of the full list -- give this to a spacer so the scrollbar stays proportional. */
  readonly totalHeight: ComputedRef<number>
  /** Bind to the scroll container. The scroll listener is attached for you. */
  readonly containerRef: Ref<HTMLElement | null>
}

/**
 * `true` when the environment can actually virtualise: we need a `window` to
 * hang scroll events off and a `ResizeObserver` to learn the container's height.
 *
 * On the server neither exists, so rather than throwing (or worse, silently
 * rendering an empty range and shipping a blank page to the crawler) the
 * composable falls back to returning every item. The markup is then correct but
 * unvirtualised, and the first client-side measurement narrows it to a real window.
 */
function canVirtualise(): boolean {
  return typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined'
}

/**
 * Windowed rendering for a long list of fixed-height rows.
 *
 * ```vue
 * <script setup lang="ts">
 * import { useVirtualList } from '@vue-ecosystem/virtual-scroll'
 *
 * const rows = ref(Array.from({ length: 100_000 }, (_, i) => `Row ${i}`))
 * const { virtualItems, totalHeight, containerRef } = useVirtualList(rows, { itemHeight: 32 })
 * </script>
 *
 * <template>
 *   <div ref="containerRef" style="height: 400px; overflow-y: auto">
 *     <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
 *       <div
 *         v-for="v in virtualItems"
 *         :key="v.index"
 *         :style="{ position: 'absolute', top: `${v.offsetTop}px`, height: '32px' }"
 *       >
 *         {{ v.item }}
 *       </div>
 *     </div>
 *   </div>
 * </template>
 * ```
 *
 * @throws {@link VirtualScrollError} `virtual-scroll/invalid-item-height` when
 * `itemHeight` is not a finite number greater than 0, or
 * `virtual-scroll/invalid-overscan` when `overscan` is not a non-negative integer.
 * Both throw synchronously from this call, not lazily on first read.
 */
export function useVirtualList<T>(
  items: MaybeRefOrGetter<T[]>,
  options: UseVirtualListOptions,
): UseVirtualListReturn<T> {
  const { itemHeight } = options
  const overscan = options.overscan ?? DEFAULT_OVERSCAN

  assertValidWindowOptions(itemHeight, overscan)

  const containerRef = shallowRef<HTMLElement | null>(null)
  const scrollTop = ref(0)
  const containerHeight = ref(0)
  const virtualise = canVirtualise()

  if (!virtualise) {
    logger.warn('no window/ResizeObserver available -- rendering the full list unvirtualised')
  }

  function handleScroll(event: Event): void {
    scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
  }

  // One watcher owns the whole DOM lifecycle: `onCleanup` runs both when the
  // template ref swaps to another element (v-if toggles) and when the effect
  // scope is disposed, so there is no separate unmount hook to keep in sync.
  if (virtualise) {
    watch(
      containerRef,
      (el, _previous, onCleanup) => {
        if (!el) {
          containerHeight.value = 0
          return
        }

        scrollTop.value = el.scrollTop
        containerHeight.value = el.clientHeight

        el.addEventListener('scroll', handleScroll, { passive: true })

        const observer = new ResizeObserver(() => {
          containerHeight.value = el.clientHeight
        })
        observer.observe(el)

        onCleanup(() => {
          el.removeEventListener('scroll', handleScroll)
          observer.disconnect()
        })
      },
      { immediate: true },
    )
  }

  const totalHeight = computed(() => computeTotalHeight(toValue(items).length, itemHeight))

  const virtualItems = computed<VirtualItem<T>[]>(() => {
    const source = toValue(items)

    // Unvirtualised fallback: every item, correct offsets. See `canVirtualise`.
    let start = 0
    let end = source.length

    if (virtualise) {
      const range = computeVirtualRange({
        scrollTop: scrollTop.value,
        containerHeight: containerHeight.value,
        itemHeight,
        itemCount: source.length,
        overscan,
      })
      start = range.startIndex
      end = range.endIndex
    }

    // `slice().map()` rather than an index loop: under `noUncheckedIndexedAccess`
    // a raw `source[i]` widens to `T | undefined`, and narrowing that would throw
    // away legitimately-undefined items.
    return source.slice(start, end).map((item, i) => ({
      index: start + i,
      item,
      offsetTop: offsetForIndex(start + i, itemHeight),
    }))
  })

  return { virtualItems, totalHeight, containerRef }
}
