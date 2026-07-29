import type { Directive, DirectiveBinding } from 'vue'
import { toEnglishDigits, toPersianDigits } from '../internal/digits'

export interface PersianDigitsOptions {
  /**
   * `'in'` (default) converts ASCII digits to Persian as the user types --
   * the usual choice for a Persian-facing text field.
   * `'out'` normalises Persian/Arabic-Indic digits to ASCII on the way in --
   * for a field whose value is consumed as plain ASCII (e.g. handed to
   * `v-model` and then straight to an API call).
   */
  readonly direction?: 'in' | 'out'
}

interface PersianDigitsState {
  readonly input: HTMLInputElement | HTMLTextAreaElement
  readonly handler: (event: Event) => void
}

const STATE = new WeakMap<HTMLElement, PersianDigitsState>()

function resolveInput(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el
  return el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
}

function readOptions(
  binding: DirectiveBinding<PersianDigitsOptions | undefined>,
): PersianDigitsOptions {
  const value = binding.value ?? {}
  return {
    direction: value.direction ?? (binding.modifiers['out'] === true ? 'out' : 'in'),
  }
}

function convert(value: string, direction: PersianDigitsOptions['direction']): string {
  return direction === 'out' ? toEnglishDigits(value) : toPersianDigits(toEnglishDigits(value))
}

function attach(
  el: HTMLElement,
  binding: DirectiveBinding<PersianDigitsOptions | undefined>,
): void {
  const input = resolveInput(el)
  if (input === null) return

  const options = readOptions(binding)

  const handler = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return

    const next = convert(target.value, options.direction)
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

  // Convert whatever the field already holds (e.g. a v-model default) too.
  const initial = convert(input.value, options.direction)
  if (initial !== input.value) input.value = initial
}

function detach(el: HTMLElement): void {
  const state = STATE.get(el)
  if (state === undefined) return
  state.input.removeEventListener('input', state.handler)
  STATE.delete(el)
}

/**
 * `v-persian-digits` -- converts digits as the user types.
 *
 * ```vue
 * <input v-persian-digits v-model="name" />
 * <input v-persian-digits.out v-model="amount" />
 * <input v-persian-digits="{ direction: 'out' }" v-model="amount" />
 * ```
 *
 * Can be placed on a wrapper element; the first nested `input`/`textarea` is used.
 * For a field that also needs RTL alignment and direction handling, use
 * `v-rtl-input` instead -- it covers digit conversion plus layout in one
 * directive. This one is for cases where only the digit conversion is wanted.
 */
export const vPersianDigits: Directive<HTMLElement, PersianDigitsOptions | undefined> = {
  mounted: attach,
  updated(el, binding) {
    detach(el)
    attach(el, binding)
  },
  unmounted: detach,
}

/** Registration name used by the plugin: `v-persian-digits`. */
export const PERSIAN_DIGITS_DIRECTIVE_NAME = 'persian-digits'
