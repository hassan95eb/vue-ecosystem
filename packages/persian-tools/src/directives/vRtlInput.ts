import type { Directive, DirectiveBinding } from 'vue'
import { toEnglishDigits, toPersianDigits } from '../internal/digits'

export interface RtlInputOptions {
  /**
   * `'persian'` displays Persian digits as the user types.
   * `'english'` normalises Persian/Arabic-Indic digits to ASCII on the way in --
   * the usual choice for a field whose value is submitted to a server.
   * `'preserve'` leaves digits untouched. Default `'preserve'`.
   */
  readonly digits?: 'persian' | 'english' | 'preserve'
  /**
   * `numeric` keeps the text direction LTR (so `-` and `.` sit correctly) while
   * aligning to the right, which is how numeric fields behave in RTL forms.
   */
  readonly numeric?: boolean
}

interface RtlInputState {
  readonly input: HTMLInputElement | HTMLTextAreaElement
  readonly handler: (event: Event) => void
}

const STATE = new WeakMap<HTMLElement, RtlInputState>()

function resolveInput(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el
  return el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
}

function readOptions(binding: DirectiveBinding<RtlInputOptions | undefined>): RtlInputOptions {
  const value = binding.value ?? {}
  return {
    digits:
      value.digits ??
      (binding.modifiers['persian'] === true
        ? 'persian'
        : binding.modifiers['english'] === true
          ? 'english'
          : 'preserve'),
    numeric: value.numeric ?? binding.modifiers['numeric'] === true,
  }
}

function applyStyles(
  input: HTMLInputElement | HTMLTextAreaElement,
  options: RtlInputOptions,
): void {
  // A numeric field reads correctly only when the *direction* is LTR; alignment
  // is what makes it sit on the right side of an RTL form.
  input.setAttribute('dir', options.numeric === true ? 'ltr' : 'rtl')
  input.style.textAlign = 'right'
  if (options.numeric === true) input.setAttribute('inputmode', 'numeric')
}

function convert(value: string, mode: RtlInputOptions['digits']): string {
  if (mode === 'english') return toEnglishDigits(value)
  if (mode === 'persian') return toPersianDigits(toEnglishDigits(value))
  return value
}

function attach(el: HTMLElement, binding: DirectiveBinding<RtlInputOptions | undefined>): void {
  const input = resolveInput(el)
  if (input === null) return

  const options = readOptions(binding)
  applyStyles(input, options)

  if (options.digits === 'preserve') {
    STATE.set(el, { input, handler: () => {} })
    return
  }

  const handler = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return

    const next = convert(target.value, options.digits)
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
 * `v-rtl-input` -- makes a form input RTL-aware.
 *
 * ```vue
 * <input v-rtl-input v-model="name" />
 * <input v-rtl-input.numeric.english v-model="amount" />
 * <input v-rtl-input="{ numeric: true, digits: 'persian' }" v-model="amount" />
 * ```
 *
 * Can be placed on a wrapper element; the first nested `input`/`textarea` is used.
 */
export const vRtlInput: Directive<HTMLElement, RtlInputOptions | undefined> = {
  mounted: attach,
  updated(el, binding) {
    detach(el)
    attach(el, binding)
  },
  unmounted: detach,
}

/** Registration name used by the plugin: `v-rtl-input`. */
export const RTL_INPUT_DIRECTIVE_NAME = 'rtl-input'
