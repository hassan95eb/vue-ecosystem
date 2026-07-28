# @vue-ecosystem/persian-tools

Persian apps keep re-solving the same four problems: converting Jalali dates without
getting leap years wrong, formatting numbers and currency the way Persian readers
expect, validating a national ID or mobile number, and getting RTL inputs to behave.
This package solves them once, for Vue 3.

The calendar and formatting logic are plain functions with no Vue import; the
composables and the directive are a thin layer on top. Use whichever half you need.

## Install

```bash
pnpm add @vue-ecosystem/persian-tools
```

## 30-second example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useJalali,
  usePersianNumber,
  vRtlInput,
  isValidNationalId,
} from '@vue-ecosystem/persian-tools'

const today = ref(new Date())
const { formatted, monthName, isLeapYear } = useJalali(today, { pattern: 'dddd D MMMM YYYY' })
// -> 'چهارشنبه ۱ فروردین ۱۴۰۳'

const { currency } = usePersianNumber(1_250_000)
// -> '۱٬۲۵۰٬۰۰۰ تومان'

const nationalId = ref('')
</script>

<template>
  <p>{{ formatted }} — {{ currency }}</p>
  <input v-rtl-input.numeric.english v-model="nationalId" />
  <p v-if="nationalId">{{ isValidNationalId(nationalId) ? 'معتبر' : 'نامعتبر' }}</p>
</template>
```

Without Vue at all:

```ts
import { gregorianToJalali, formatJalali } from '@vue-ecosystem/persian-tools/jalali'
import { formatCurrency } from '@vue-ecosystem/persian-tools/number'

formatJalali(gregorianToJalali(2024, 3, 20), 'D MMMM YYYY') // '۱ فروردین ۱۴۰۳'
formatCurrency(1_250_000) // '۱٬۲۵۰٬۰۰۰ تومان'
```

## What's in it

**Calendar** (`/jalali`) — `gregorianToJalali`, `jalaliToGregorian`, `dateToJalali`,
`jalaliToDate`, `isLeapJalaliYear`, `jalaliMonthLength`, `isValidJalaliDate`,
`addJalaliDays`, `addJalaliMonths`, `jalaliDayOfWeek`, `jalaliDayOfYear`,
`formatJalali`, `parseJalali`.

**Numbers** (`/number`) — `toPersianDigits`, `toEnglishDigits`, `formatNumber`,
`parsePersianNumber`, `formatCurrency`, `rialToToman`, `tomanToRial`.

**Validation** (`/validation`) — `isValidNationalId`, `isValidIranianMobile`,
`normalizeIranianMobile`.

**Vue layer** — `useJalali`, `usePersianNumber`, `v-rtl-input`.

## Notes on the calendar

Leap years use the 33-year-cycle algorithm, not a `year % 4` rule. The two disagree —
1407 is _not_ a leap year even though it is divisible by 4 — and a naive
implementation is off by a day for the whole of Esfand in those years. Supported
range: Jalali years −61 to 3177. Conversions are checked day-by-day against the
runtime's own `Intl` Persian calendar in the test suite.

`Date` values are read in the host's local time zone. If you need another zone,
convert the `Date` before passing it in rather than relying on a guess.

## Formatting tokens

| Token  | Output    | Token      | Output     |
| ------ | --------- | ---------- | ---------- |
| `YYYY` | `۱۴۰۳`    | `MM` / `M` | `۰۱` / `۱` |
| `YY`   | `۰۳`      | `DD` / `D` | `۰۱` / `۱` |
| `MMMM` | `فروردین` | `dddd`     | `چهارشنبه` |

Text in `[square brackets]` is emitted literally.

## Docs

Full documentation lives in the repo for now; a VitePress site lands with v1.0.
See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the design decisions behind the
pure-core / composable-wrapper split.

MIT © vue-ecosystem contributors
