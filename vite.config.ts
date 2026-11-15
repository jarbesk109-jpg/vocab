import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// v2 "Recall". Mã nguồn ở v2/, logic dùng chung ở logic/ (ngoài root nên phải cho phép đọc thư mục cha).
// `base: './'` để bản build chạy được ở bất kỳ đường dẫn con nào của GitHub Pages (/vocab/v2/ rồi /vocab/).
export default defineConfig({
  root: 'v2',
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174, // 5173 để dành cho v1 (python -m http.server)
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
