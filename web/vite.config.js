import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH permite servir la app bajo una subruta, p. ej. BASE_PATH=/app -> dominio.com/app/dashboard
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { [`${base}api`]: 'http://localhost:4000' },
  },
});
