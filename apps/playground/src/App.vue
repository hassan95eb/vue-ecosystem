<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useJalali,
  usePersianNumber,
  useIban,
  useCardNumber,
  vRtlInput,
  vPersianDigits,
  vHalfSpace,
  isValidNationalId,
  isValidIranianMobile,
  normalizeIranianMobile,
  jalaliMonthLength,
  jalaliDayOfWeek,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_NAMES,
  parsePersianNumber,
  PersianDateRangePicker,
  HolidayBadge,
  RelativeDate,
  isJalaliHoliday,
  type JalaliDateParts,
  type JalaliRange,
} from '@vue-ecosystem/persian-tools'

// --- A small Jalali date picker, driven entirely by the package ---------------
const today = useJalali(new Date())
const selected = ref<JalaliDateParts>(today.parts.value)

const view = useJalali(selected, { pattern: 'dddd D MMMM YYYY' })
const daysInMonth = computed(() => jalaliMonthLength(selected.value.jy, selected.value.jm))
const years = computed(() => {
  const current = today.year.value
  return Array.from({ length: 11 }, (_, i) => current - 5 + i)
})
// Blank cells before the 1st, so the grid lines up with the weekday header.
const leadingBlanks = computed(() =>
  jalaliDayOfWeek({ jy: selected.value.jy, jm: selected.value.jm, jd: 1 }),
)

function setPart(part: keyof JalaliDateParts, value: number): void {
  const next = { ...selected.value, [part]: value }
  next.jd = Math.min(next.jd, jalaliMonthLength(next.jy, next.jm))
  selected.value = next
}

// --- Number / currency -------------------------------------------------------
const amountText = ref('1250000')
const amount = computed(() => parsePersianNumber(amountText.value))
const money = usePersianNumber(amount, { currency: 'toman' })

// --- Validation --------------------------------------------------------------
const nationalId = ref('')
const mobile = ref('')
const nationalIdState = computed(() =>
  nationalId.value === '' ? null : isValidNationalId(nationalId.value),
)
const mobileState = computed(() =>
  mobile.value === '' ? null : isValidIranianMobile(mobile.value),
)

// --- IBAN / card number, via the reactive composables ------------------------
const iban = ref('')
const { isValid: ibanValid, normalized: ibanNormalized } = useIban(iban)

const cardNumber = ref('')
const { isValid: cardValid, normalized: cardNormalized } = useCardNumber(cardNumber)

// --- Date range picker --------------------------------------------------------
const range = ref<JalaliRange>({ start: null, end: null })

// --- Holiday badge / relative date --------------------------------------------
// Reuses `selected` from the calendar above -- moving the date there (or via
// the quick-jump buttons below) drives both of these live, instead of a
// static, unchanging example.
const holidayQuickJumps = [
  { label: 'نوروز', jm: 1, jd: 1 },
  { label: 'روز طبیعت', jm: 1, jd: 13 },
  { label: '۲۲ بهمن', jm: 11, jd: 22 },
] as const

function goToHoliday(jm: number, jd: number): void {
  selected.value = { jy: selected.value.jy, jm, jd }
}

// --- New directives ------------------------------------------------------------
const digitsText = ref('')
const halfSpaceText = ref('')
</script>

<template>
  <main class="page">
    <header class="ltr" dir="ltr">
      <h1>vue-ecosystem playground</h1>
      <p>
        Live demo of <code>@vue-ecosystem/persian-tools</code>. The other packages are skeletons —
        they will appear here as they are built.
      </p>
    </header>

    <section class="card">
      <h2>تاریخ جلالی — <code>useJalali</code></h2>

      <div class="row">
        <div>
          <label for="year">سال</label>
          <select
            id="year"
            :value="selected.jy"
            @change="setPart('jy', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div>
          <label for="month">ماه</label>
          <select
            id="month"
            :value="selected.jm"
            @change="setPart('jm', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="(name, i) in JALALI_MONTH_NAMES" :key="name" :value="i + 1">
              {{ name }}
            </option>
          </select>
        </div>
      </div>

      <div class="calendar">
        <!--
          Both spellings are rendered and one is hidden by a media query. The full
          name is used wherever the column is wide enough; below that the fallback is
          a uniform single letter rather than a mid-word cut like "چها" or "سه‌".
        -->
        <span v-for="w in JALALI_WEEKDAY_NAMES" :key="w" class="weekday">
          <span class="weekday__full">{{ w }}</span>
          <span class="weekday__short">{{ w[0] }}</span>
        </span>
        <span v-for="b in leadingBlanks" :key="`b${b}`" />
        <button
          v-for="d in daysInMonth"
          :key="d"
          type="button"
          class="day"
          :class="{ active: d === selected.jd }"
          @click="setPart('jd', d)"
        >
          {{ d }}
        </button>
      </div>

      <p class="out">{{ view.formatted.value }}</p>
      <p class="muted">
        میلادی: {{ view.gregorian.value.toISOString().slice(0, 10) }} · روز
        {{ view.dayOfYear.value }} سال ·
        {{ view.isLeapYear.value ? 'سال کبیسه' : 'سال عادی' }}
      </p>
    </section>

    <section class="card">
      <h2>عدد و مبلغ — <code>usePersianNumber</code> + <code>v-rtl-input</code></h2>
      <label for="amount">مبلغ (ارقام فارسی هم قبول است)</label>
      <input id="amount" v-model="amountText" v-rtl-input.numeric />
      <p class="out">{{ money.currency.value }}</p>
      <p class="muted">بدون واحد: {{ money.formatted.value }}</p>
    </section>

    <section class="card">
      <h2>اعتبارسنجی — <code>isValidNationalId</code> / <code>isValidIranianMobile</code></h2>
      <label for="nid">کد ملی</label>
      <input id="nid" v-model="nationalId" v-rtl-input.numeric.english maxlength="10" />
      <p v-if="nationalIdState !== null" class="muted" :class="nationalIdState ? 'ok' : 'bad'">
        {{ nationalIdState ? 'کد ملی معتبر است' : 'کد ملی نامعتبر است' }}
      </p>

      <label for="mobile" class="label--spaced">شماره موبایل</label>
      <input id="mobile" v-model="mobile" v-rtl-input.numeric.english />
      <p v-if="mobileState !== null" class="muted" :class="mobileState ? 'ok' : 'bad'">
        {{ mobileState ? `معتبر — ${normalizeIranianMobile(mobile)}` : 'شماره نامعتبر است' }}
      </p>
    </section>

    <section class="card">
      <h2>اعتبارسنجی مالی — <code>useIban</code> / <code>useCardNumber</code></h2>
      <label for="iban">شماره شبا (IBAN)</label>
      <input id="iban" v-model="iban" v-rtl-input.numeric.english placeholder="IR..." />
      <p v-if="iban !== ''" class="muted" :class="ibanValid ? 'ok' : 'bad'">
        {{ ibanValid ? `معتبر — ${ibanNormalized}` : 'شماره شبا نامعتبر است' }}
      </p>

      <label for="card" class="label--spaced">شماره کارت بانکی</label>
      <input id="card" v-model="cardNumber" v-rtl-input.numeric.english maxlength="19" />
      <p v-if="cardNumber !== ''" class="muted" :class="cardValid ? 'ok' : 'bad'">
        {{ cardValid ? `معتبر — ${cardNormalized}` : 'شماره کارت نامعتبر است' }}
      </p>
    </section>

    <section class="card">
      <h2>دایرکتیوهای جدید — <code>v-persian-digits</code> / <code>v-half-space</code></h2>
      <label for="digits">ارقام فارسی خودکار (یک عدد انگلیسی تایپ کنید)</label>
      <input id="digits" v-model="digitsText" v-persian-digits placeholder="1403" />

      <label for="halfspace" class="label--spaced"
        >نیم‌فاصله خودکار (مثلاً «می روم» تایپ کنید)</label
      >
      <input id="halfspace" v-model="halfSpaceText" v-half-space placeholder="می روم" />
    </section>

    <section class="card">
      <h2>بازه تاریخ — <code>PersianDateRangePicker</code></h2>
      <PersianDateRangePicker v-model="range" />
    </section>

    <section class="card">
      <h2>روز تعطیل و تاریخ نسبی — <code>HolidayBadge</code> / <code>RelativeDate</code></h2>
      <p class="muted">
        همون تاریخِ انتخاب‌شده در بخش «تاریخ جلالی» بالا رو نشان می‌دهد — تاریخ را از آنجا عوض کنید
        تا این‌جا هم زنده تغییر کند.
      </p>

      <p class="row-inline">
        <RelativeDate :date="selected" />
        <HolidayBadge :date="selected" />
        <span v-if="!isJalaliHoliday(selected)" class="muted">(تعطیل رسمی ثابت نیست)</span>
      </p>

      <p class="muted label--spaced">پرش سریع به یک تعطیلی برای دیدن نشان:</p>
      <div class="row-inline">
        <button
          v-for="holiday in holidayQuickJumps"
          :key="holiday.label"
          type="button"
          class="chip"
          @click="goToHoliday(holiday.jm, holiday.jd)"
        >
          {{ holiday.label }}
        </button>
        <button type="button" class="chip" @click="selected = today.parts.value">امروز</button>
      </div>
    </section>

    <section class="card todo ltr" dir="ltr">
      <h2>Coming next</h2>
      <ul>
        <li>realtime — highest product priority</li>
        <li>smart-table</li>
        <li>state-machine</li>
        <li>query-builder</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.label--spaced {
  margin-top: var(--space-5);
}

.row-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.row-inline + .row-inline {
  margin-top: var(--space-3);
}

.chip {
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--accent-hover);
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.chip:hover {
  background: var(--accent-border);
}

/* -------------------------------------------------------------------------
 * Calendar
 * ---------------------------------------------------------------------- */
.calendar {
  display: grid;
  /* minmax(0, 1fr) rather than 1fr: without it a grid item refuses to shrink
     below its content width, which is what pushed the weekday labels out of
     their columns in the first place. */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
  margin-top: var(--space-5);
  padding: var(--space-3);
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.weekday {
  padding-bottom: var(--space-2);
  font-size: 0.75rem;
  font-weight: 550;
  line-height: 1.4;
  text-align: center;
  color: var(--text-secondary);
  /* Never truncate mid-word; the short form takes over instead. */
  white-space: nowrap;
  overflow: visible;
}

.weekday__short {
  display: none;
}

/* Under ~34rem the widest label ("چهارشنبه") no longer fits its column, so the
   single-letter form is shown for every day -- uniform, never half a word. */
@media (max-width: 34rem) {
  .weekday__full {
    display: none;
  }

  .weekday__short {
    display: inline;
  }
}

/* -------------------------------------------------------------------------
 * Day buttons
 * ---------------------------------------------------------------------- */
.day {
  /* Equal square cells, so the grid stays even whatever the month length. */
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  /* 16:1 against the button surface. */
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.day:hover {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-hover);
}

.day:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.day.active,
.day.active:hover {
  /* White on --accent is 8.5:1; the heavier, larger numeral keeps the Persian
     digit legible against the filled background. */
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
}
</style>
