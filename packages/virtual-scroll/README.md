# @vue-ecosystem/virtual-scroll

Headless virtual scrolling composable for large lists and grids.

- **Dependency layer:** 1 — depends on `core` only
- **Build tool:** tsup — logic only, no `.vue` files ([ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision))
- **Version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## Install

```bash
pnpm add @vue-ecosystem/virtual-scroll
```

`vue` (^3.4) is a peer dependency.

## `useVirtualList()`

Renders only the rows inside the viewport, for lists of **fixed-height** rows.
The scroll listener and the container measurement are wired up internally — bind
`containerRef` to the scroll container and that is the whole integration.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useVirtualList } from '@vue-ecosystem/virtual-scroll'

const rows = ref(Array.from({ length: 100_000 }, (_, i) => `Row ${i}`))

const { virtualItems, totalHeight, containerRef } = useVirtualList(rows, {
  itemHeight: 32,
})
</script>

<template>
  <div ref="containerRef" style="height: 400px; overflow-y: auto">
    <!-- Spacer: gives the scrollbar the proportions of the full list. -->
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="v in virtualItems"
        :key="v.index"
        :style="{ position: 'absolute', top: `${v.offsetTop}px`, height: '32px', width: '100%' }"
      >
        {{ v.item }}
      </div>
    </div>
  </div>
</template>
```

### Parameters

| Name                 | Type                    | Default | Notes                                                |
| -------------------- | ----------------------- | ------- | ---------------------------------------------------- |
| `items`              | `MaybeRefOrGetter<T[]>` | —       | Array, ref or getter                                 |
| `options.itemHeight` | `number`                | —       | Pixels. Must be finite and `> 0`                     |
| `options.overscan`   | `number`                | `4`     | Rows rendered beyond each edge. Non-negative integer |

### Returns

| Name           | Type                            | Notes                                                         |
| -------------- | ------------------------------- | ------------------------------------------------------------- |
| `virtualItems` | `ComputedRef<VirtualItem<T>[]>` | `{ index, item, offsetTop }`; `index` is into the source list |
| `totalHeight`  | `ComputedRef<number>`           | Height of the full list, for the spacer                       |
| `containerRef` | `Ref<HTMLElement \| null>`      | Bind to the scroll container                                  |

### Overscan

`overscan` is how many rows are rendered past each edge of the viewport. It only
has to cover the rows a fast scroll can reveal between a scroll event firing and
the next paint — the default of **4** buys a frame or two of already-mounted rows
before blank space appears, at a flat cost of 8 extra rows regardless of how long
the list is. Raise it if you see blanking during a fast flick; drop it to `0` if
rows are expensive to render.

### Server-side rendering

On the server there is no `window` and no `ResizeObserver`, so the composable
returns the **full, unvirtualised** list with correct offsets rather than
throwing or rendering an empty range. The server markup is therefore complete,
and the first client-side measurement narrows it to a real window.

### Errors

Both throw synchronously from the `useVirtualList()` call, not lazily on first read:

| Code                                 | When                                               |
| ------------------------------------ | -------------------------------------------------- |
| `virtual-scroll/invalid-item-height` | `itemHeight` is not a finite number greater than 0 |
| `virtual-scroll/invalid-overscan`    | `overscan` is not a non-negative integer           |

Check them with `isEcosystemError()` from `@vue-ecosystem/core`, never with
`instanceof` — see [ARCHITECTURE.md](../../ARCHITECTURE.md#dual-package-hazard).

## The pure windowing core

The math is a plain module with no Vue import, exported for anyone building
their own renderer on top of it (this is how `smart-table` consumes it):

```ts
import { computeVirtualRange } from '@vue-ecosystem/virtual-scroll'

computeVirtualRange({ scrollTop: 0, containerHeight: 100, itemHeight: 20, itemCount: 1000 })
// { startIndex: 0, endIndex: 9, startOffset: 0, totalHeight: 20000 }
```

`endIndex` is **exclusive**, so `items.slice(startIndex, endIndex)` is the
rendered window and an empty window is just `startIndex === endIndex`.
`computeTotalHeight()` and `offsetForIndex()` are exported alongside it.

## TODO

- [x] MVP: `useVirtualList()` for fixed row heights
- [ ] Variable / measured row heights
- [ ] Horizontal and grid virtualisation
- [ ] Scroll-to-index and sticky rows
- [ ] Benchmark against a 100k-row baseline

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
