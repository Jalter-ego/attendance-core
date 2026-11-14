import { defineConfig } from 'vitest/config';

// Pruebas unitarias (sin base de datos). El e2e de test/ necesita PostgreSQL y no entra aquí.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
