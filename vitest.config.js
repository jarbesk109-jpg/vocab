import { defineConfig } from 'vitest/config';

// Tách riêng khỏi vite.config.ts (root của Vite là v2/): test của logic/ nằm ở tests/ tại gốc repo.
export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
  },
});
