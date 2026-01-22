
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inject API_KEY từ môi trường build vào ứng dụng
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  // Base path phải khớp với tên dự án trên GitHub Pages
  base: '/melodify-ai/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false
  }
});
