
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inject API_KEY vào mã nguồn trong quá trình build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  // Base path khớp với tên repository GitHub
  base: '/melodify-ai/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
    // Đã xóa minify: 'terser' để dùng mặc định (esbuild) - tránh lỗi thiếu thư viện terser
  }
});
