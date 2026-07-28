/** Digit-set conversion. Pure, no Vue. */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

// Persian (Extended Arabic-Indic, U+06F0..U+06F9) and Arabic-Indic (U+0660..U+0669)
// look alike but are different code points; user input contains both.
const PERSIAN_DIGIT_RE = /[۰-۹]/g
const ARABIC_DIGIT_RE = /[٠-٩]/g

/** Converts every ASCII digit in the string to its Persian equivalent. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d)
}

/** Converts Persian and Arabic-Indic digits to ASCII. Other characters pass through. */
export function toEnglishDigits(input: string | number): string {
  return String(input)
    .replace(PERSIAN_DIGIT_RE, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(ARABIC_DIGIT_RE, (d) => String(d.charCodeAt(0) - 0x0660))
}

/** True when the string contains at least one Persian or Arabic-Indic digit. */
export function hasNonAsciiDigits(input: string): boolean {
  return /[۰-۹٠-٩]/.test(input)
}
