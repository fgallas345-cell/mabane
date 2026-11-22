import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Port dédié à Mabane : d'autres projets Vite tournent sur 5173/5174 sur ce poste.
  // strictPort : si 5180 est pris, Vite s'arrête au lieu de basculer en silence sur un autre port.
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
})
