import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  assetsInclude: ['**/*.wgsl'],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  }
});