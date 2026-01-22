
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Đảm bảo process.env.API_KEY có thể hoạt động trong môi trường trình duyệt
    'process.env': process.env
  },
  // Nếu bạn đặt tên repo GitHub khác với root, hãy đổi base này thành '/ten-repo/'
  base: './', 
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
