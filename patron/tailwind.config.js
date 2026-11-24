/** @type {import('tailwindcss').Config} */
// Même charte que l'application de la boutique : marine du logo + orange
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#071f34', 800: '#0d2550', 700: '#13306f', 600: '#1a3f95', 500: '#1d4fb8' },
        accent: { 50: '#fff6ea', 100: '#fde9cc', 400: '#f6ad45', 500: '#f39e26', 600: '#dd8514' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(7,31,52,0.04), 0 1px 3px rgba(7,31,52,0.06)' },
    },
  },
  plugins: [],
}
