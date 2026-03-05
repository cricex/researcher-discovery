/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'azure-blue': '#0078D4',
        'azure-light': '#50E6FF',
        'green-accent': '#107C10',
      }
    },
  },
  plugins: [],
}

