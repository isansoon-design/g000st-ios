/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        g000st: {
          black: '#111111',
          red: '#C62828',
          silver: '#9A9A9A',
          metal: '#E8E8E8',
          muted: '#444444',
        },
        night: {
          canvas: '#929197',
          header: '#85848B',
          surface: '#414046',
          raised: '#77767C',
          control: '#5C5B61',
          text: '#FFFFFF',
          muted: '#E0DEE2',
          border: '#66656B',
          softred: '#482427',
        },
      },
      borderRadius: {
        field: '14px',
      },
    },
  },
  plugins: [],
};
