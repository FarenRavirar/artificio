/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'azul-escuro': '#1B2A4A',
        'laranja': '#FF5722',
        'branco': '#FFFFFF',
        'cinza-fundo': '#F4F4F4',
        'cinza-texto': '#555555',
        'azul-medio': '#2E4A7A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
