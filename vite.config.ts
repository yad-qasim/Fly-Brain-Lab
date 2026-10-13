import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: 'index.html',
        brain: 'brain.html',
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
