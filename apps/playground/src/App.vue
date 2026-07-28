<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useJalali,
  usePersianNumber,
  vRtlInput,
  isValidNationalId,
  isValidIranianMobile,
  normalizeIranianMobile,
  jalaliMonthLength,
  jalaliDayOfWeek,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_NAMES,
  parsePersianNumber,
  type JalaliDateParts,
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
</script>

<template>
  <main class="page">
    <h1>vue-ecosystem playground</h1>
    <p class="muted">
      Live demo of <code>@vue-ecosystem/persian-tools</code>. The other packages are skeletons —
      they will appear here as they are built.
    </p>

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
        <span v-for="w in JALALI_WEEKDAY_NAMES" :key="w" class="weekday">{{ w.slice(0, 3) }}</span>
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

      <label for="mobile" style="margin-top: 1rem">شماره موبایل</label>
      <input id="mobile" v-model="mobile" v-rtl-input.numeric.english />
      <p v-if="mobileState !== null" class="muted" :class="mobileState ? 'ok' : 'bad'">
        {{ mobileState ? `معتبر — ${normalizeIranianMobile(mobile)}` : 'شماره نامعتبر است' }}
      </p>
    </section>

    <section class="card todo">
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
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  margin-top: 1rem;
}

.weekday {
  text-align: center;
  font-size: 0.75rem;
  color: #5b6070;
  padding-bottom: 0.25rem;
}

.day {
  padding: 0.45rem 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #f1f2f5;
  font: inherit;
  cursor: pointer;
}

.day:hover {
  border-color: #b9bec9;
}

.day.active {
  background: #16181d;
  color: #fff;
}

code {
  font-size: 0.85em;
  background: #f1f2f5;
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
</style>
