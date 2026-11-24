import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Application « Mabane Patron » : port distinct de l'application de la boutique (5180)
export default defineConfig({
  plugins: [react()],
  server: { port: 5190, strictPort: true },
  preview: { port: 5191, strictPort: true },
})
