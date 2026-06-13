/** @type {import('tailwindcss').Config} */
export default {
  // Dark via atributo do runtime canônico de tema (@artificio/ui theme.tsx):
  // <html data-theme="dark">. NÃO usar media-query (default v3) — o tema é
  // controlado por cookie/toggle, não pela preferência do SO. (Spec 020 D065)
  darkMode: ['selector', '[data-theme="dark"]'],
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
