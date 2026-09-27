import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './features/**/*.{js,ts,jsx,tsx}',
    './context/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#111111',
        secondary: '#C62828',
        silver: {
          50: '#F7F7F7',
          100: '#F2F2F2',
          200: '#E8E8E8',
          300: '#D8D8D8',
          400: '#C0C0C0',
          500: '#A3A3A3',
          600: '#8A8A8A',
          700: '#6A6A6A',
          800: '#4A4A4A',
          900: '#2A2A2A',
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
          incoming: '#C1282D',
          outgoing: '#111111',
        },
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
export default config
