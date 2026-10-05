import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Las pruebas corren en Node, sin Supabase ni GitHub reales: todo lo externo
// se reemplaza por dobles en memoria (ver tests/helpers.ts).
export default defineConfig({
  resolve: {
    alias: {
      // Mismo alias que tsconfig.json ("@/*" -> raiz de admin/).
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true
  }
});
