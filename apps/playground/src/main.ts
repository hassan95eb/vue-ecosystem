import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
// Needed for PersianDateRangePicker / HolidayBadge / RelativeDate -- see the
// package README's "Install" section.
import '@vue-ecosystem/persian-tools/style.css'

createApp(App).mount('#app')
