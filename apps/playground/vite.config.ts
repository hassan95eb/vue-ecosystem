import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // Bind to the IPv4 loopback explicitly. On Windows, `localhost` frequently
    // resolves to ::1 while a server bound only to 127.0.0.1 never answers it --
    // which shows up in the browser as ERR_CONNECTION_REFUSED even though the dev
    // server started fine. Pinning the host makes the printed URL the one that works.
    host: '127.0.0.1',
    port: 5173,
    // Without this, a busy port makes Vite silently move to 5174 while the docs (and
    // the reader) still say 5173. Fail loudly instead.
    strictPort: true,
    // Open the real URL once the server is actually listening, so nobody has to guess
    // when the dependency builds have finished.
    open: true,
  },
})
