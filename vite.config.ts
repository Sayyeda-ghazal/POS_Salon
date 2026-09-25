import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths: the packaged app loads index.html via file://, where /assets would resolve to the drive root.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
