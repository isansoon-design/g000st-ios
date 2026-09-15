/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
      borderRadius: {
        field: '14px',
      },
    },
  },
  plugins: [],
};
