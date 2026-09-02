/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#27272a',
          750: '#1e1e22',
          800: '#18181b',
          850: '#121215',
          900: '#09090b',
          950: '#000000',
        },
        brand: {
          50: '#f4f4f5',
          100: '#e4e4e7',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          900: '#18181b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
