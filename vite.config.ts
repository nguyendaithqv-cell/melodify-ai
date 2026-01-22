
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Đảm bảo API_KEY được thay thế trực tiếp vào mã nguồn khi build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  // Base path cho GitHub Pages
  base: '/melodify-ai/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser'
  },
  server: {
    port: 3000
  }
});
