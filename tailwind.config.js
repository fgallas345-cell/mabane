/** @type {import('tailwindcss').Config} */
// Charte Mabane, tirée du logo :
//   brand  = bleu marine du logo (#071F34) : structure, boutons principaux, titres
//   accent = orange du logo (#F39E26)      : actions clés (vendre, encaisser), repères, menu actif
// L'orange vif n'est jamais utilisé comme couleur de texte sur fond clair (contraste insuffisant) :
// on l'emploie en fond, avec un texte marine (accent-ink).
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3f9',
          100: '#dbe5f0',
          200: '#b8cadf',
          300: '#a9c2df', // texte de marque en mode sombre
          400: '#8fb0d4', // icônes / liens en mode sombre
          500: '#3f6a9c',
          600: '#1e4572', // boutons, liens (contraste AA sur blanc)
          700: '#143457',
          800: '#0d2745',
          900: '#071f34', // marine du logo : barre latérale
          950: '#04121f',
        },
        accent: {
          50: '#fff6ea',
          100: '#fde9cc',
          200: '#fbd39a',
          300: '#f8bc66',
          400: '#f6ad45',
          500: '#f39e26', // orange du logo
          600: '#dd8514',
          700: '#b0650c', // texte orange lisible sur fond clair
          800: '#8a4f0d',
          900: '#71420f',
          ink: '#071f34',
        },
        darkbg: '#07121f',
        darkcard: '#0e1f33',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(7,31,52,0.04), 0 1px 3px rgba(7,31,52,0.06)',
        lift: '0 4px 12px rgba(7,31,52,0.08), 0 2px 4px rgba(7,31,52,0.04)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'pop-in': 'pop-in 160ms ease-out',
        'fade-in': 'fade-in 160ms ease-out',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
