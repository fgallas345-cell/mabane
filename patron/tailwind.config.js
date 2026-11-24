/** @type {import('tailwindcss').Config} */
// Charte « Mabane Patron » (identique à l'application de la boutique) :
//   navy-500 #1d4fb8 : bleu roi (icônes, liens, haut des dégradés)
//   navy-700 #13306f : marine (pastilles actives, boutons principaux)
//   navy-900 #071f34 : texte
//   accent   #f39e26 : orange du logo (prénom, puces, actions clés)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#f3f6fb',
        navy: { 900: '#071f34', 800: '#0d2b6b', 700: '#13306f', 600: '#163f9a', 500: '#1d4fb8', 400: '#2563eb' },
        accent: { 50: '#fff6ea', 100: '#fde9cc', 400: '#f6ad45', 500: '#f39e26', 600: '#dd8514' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 6px 20px -10px rgba(7,31,52,0.25)', // cartes
        row: '0 4px 14px -8px rgba(7,31,52,0.25)', // lignes de liste
        pill: '0 8px 18px -8px rgba(19,48,111,0.8)', // pastilles / boutons marine
        hero: '0 18px 36px -16px rgba(19,48,111,0.75)', // grandes cartes bleues
        cta: '0 10px 24px -10px rgba(243,158,38,0.7)', // bouton orange
        nav: '0 -8px 30px -12px rgba(7,31,52,0.25)', // barre du bas
      },
    },
  },
  plugins: [],
}
