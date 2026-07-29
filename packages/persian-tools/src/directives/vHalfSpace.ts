import type { Directive } from 'vue'
import { halfSpace } from '@persian-tools/persian-tools'

/**
 * Inserts the Persian "half space" (zero-width non-joiner, `‌`) at the
 * standard prefix/suffix boundaries -- `می‌روم` rather than `می روم` or
 * `میروم`. Delegated to `@persian-tools/persian-tools`'s `halfSpace`, same as
 * the validators in `internal/validation-core.ts`: this is exactly the kind
 * of "known Persian-text rule with a lot of edge cases" the finalized scope
 * decision says should be wrapped, not reimplemented.
 */

interface HalfSpaceState {
  readonly input: HTMLInputElement | HTMLTextAreaElement
  readonly handler: (event: Event) => void
}

const STATE = new WeakMap<HTMLElement, HalfSpaceState>()

function resolveInput(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el
  return el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
}

function attach(el: HTMLElement): void {
  const input = resolveInput(el)
  if (input === null) return

  const handler = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return

    const next = halfSpace(target.value)
    if (next === target.value) return

    // Caret would otherwise jump to the end on every keystroke.
    const caret = target.selectionStart
    target.value = next
    if (caret !== null) {
      try {
        target.setSelectionRange(caret, caret)
      } catch {
        // Some input types (email, number) forbid selection APIs.
      }
    }
    // Keep v-model in sync without re-entering this handler.
    target.dispatchEvent(new Event('input', { bubbles: false }))
  }

  input.addEventListener('input', handler)
  STATE.set(el, { input, handler })
}

function detach(el: HTMLElement): void {
  const state = STATE.get(el)
  if (state === undefined) return
  state.input.removeEventListener('input', state.handler)
  STATE.delete(el)
}

/**
 * `v-half-space` -- fixes up Persian half-space typography as the user types.
 *
 * ```vue
 * <input v-half-space v-model="text" />
 * <textarea v-half-space v-model="bio" />
 * ```
 *
 * Can be placed on a wrapper element; the first nested `input`/`textarea` is used.
 */
export const vHalfSpace: Directive<HTMLElement, undefined> = {
  mounted: attach,
  updated(el) {
    detach(el)
    attach(el)
  },
  unmounted: detach,
}

/** Registration name used by the plugin: `v-half-space`. */
export const HALF_SPACE_DIRECTIVE_NAME = 'half-space'
