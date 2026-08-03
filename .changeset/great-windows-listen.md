---
'@vue-ecosystem/virtual-scroll': minor
---

Shipped the package's MVP: `useVirtualList()`, windowed rendering for long lists of
fixed-height rows. Returns `virtualItems` (`{ index, item, offsetTop }`),
`totalHeight` for the spacer, and a `containerRef` that wires up the scroll
listener and a `ResizeObserver` internally — the consumer never attaches
`@scroll` by hand. On the server, where neither `window` nor `ResizeObserver`
exists, it falls back to the full unvirtualised list rather than throwing or
rendering an empty range.

The windowing math is a pure, framework-agnostic module and is exported too
(`computeVirtualRange`, `computeTotalHeight`, `offsetForIndex`), so anything
building its own renderer on top — `smart-table` first — can use it without the
composable. `endIndex` is exclusive, so the rendered window is
`items.slice(startIndex, endIndex)`. A `scrollTop` past the end of the list (a
list that shrank while the user was scrolled down) clamps to the last full
screen rather than producing an empty window.

The package moves from a private skeleton to a real, publishable `0.1.0`. This
pass is scoped to what `smart-table` needs; the rest of the package's planned
scope — measured/variable row heights, horizontal and grid virtualisation,
`scrollToIndex` and sticky rows, and the 100k-row benchmark — is tracked in the
package README and deliberately not part of it.
