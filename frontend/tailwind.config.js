/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          primary: '#1769aa',
          accent: '#087f5b',
          danger: '#c92a3a',
          warning: '#d98b00',
        }
      }
    },
  },
  plugins: [],
}
