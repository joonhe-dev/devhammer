import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  shebang: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  sourcemap: true,
});
