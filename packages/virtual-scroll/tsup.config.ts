import { defineConfig } from 'tsup'

// Logic-only package (no .vue SFCs) -> tsup. See the build-tool table in ARCHITECTURE.md.
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
