import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    format: 'esm',
    dts: {
      entry: ['./src/index.ts'],
    },
    clean: true,
    esbuildOptions(options, context) {
      options.platform = 'node';
    },
  },
]);
