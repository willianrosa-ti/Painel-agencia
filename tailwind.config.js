/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aqui está a mágica! Em vez de uma cor fixa, usamos uma variável do CSS
        'cor-agencia': 'var(--cor-agencia)', 
        'cinza-botao': '#333333',
      }
    },
  },
  plugins: [],
}