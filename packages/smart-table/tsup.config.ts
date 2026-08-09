import { defineConfig } from 'tsup'

// Headless package -- no .vue SFCs yet, so tsup. The styled shell planned for
// the next milestone is what will move this to Vite library mode; see the
// build-tool table in ARCHITECTURE.md.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  external: ['vue'],
})
