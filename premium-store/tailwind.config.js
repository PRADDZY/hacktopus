/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        dark: '#1A1A1A',
        light: '#FAFAFA',
        beige: '#F5E6D3',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      boxShadow: {
        'brutal': '6px 6px 0px 0px #000',
        'brutal-sm': '3px 3px 0px 0px #000',
        'brutal-lg': '10px 10px 0px 0px #000',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
