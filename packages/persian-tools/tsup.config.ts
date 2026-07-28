import { defineConfig } from 'tsup'

// Phase 1 ships composables + a directive only -- no .vue SFCs -- so tsup applies.
// See the build-tool table in ARCHITECTURE.md before adding a component here.
export default defineConfig({
  entry: ['src/index.ts', 'src/jalali.ts', 'src/number.ts', 'src/validation.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  external: ['vue', '@vue-ecosystem/core'],
})
