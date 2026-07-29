import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

// This package now ships real .vue SFCs (PersianDateRangePicker and the small
// badge components), which moves it out of the tsup row of the build-tool
// table in ARCHITECTURE.md and into the Vite-library-mode row: esbuild (which
// tsup wraps) has no native `<template>` / `<script setup>` support. See
// ARCHITECTURE.md's "Build tool decision" section before changing this.
//
// The multi-entry `exports` map in package.json is unchanged by this
// migration -- same four entry points, same ESM + CJS + `.d.ts` output shape.
// `vite-plugin-dts` mirrors the `src/` structure into `dist/` (one `.d.ts`
// per source file, the same way `tsc --declaration` would) rather than
// bundling each entry's types into a single rolled-up file the way tsup did;
// the four files the exports map actually points at (`dist/index.d.ts`,
// `dist/jalali.d.ts`, `dist/number.d.ts`, `dist/validation.d.ts`) still exist
// and still re-export the same public type surface, so this is not a
// resolution change for consumers.
export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
      include: ['src/**/*.ts', 'src/**/*.vue'],
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        jalali: resolve(__dirname, 'src/jalali.ts'),
        number: resolve(__dirname, 'src/number.ts'),
        validation: resolve(__dirname, 'src/validation.ts'),
      },
      formats: ['es', 'cjs'],
      // Explicit rather than relying on Vite's defaults, so the file names
      // stay byte-for-byte what tsup produced (`index.js` / `index.cjs`,
      // not `index.mjs` or a nested `es/`+`cjs/` layout) and the `exports`
      // map in package.json does not need to change.
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue', '@vue-ecosystem/core', '@persian-tools/persian-tools'],
    },
    emptyOutDir: true,
  },
})
