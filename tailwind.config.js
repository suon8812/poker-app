/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          950: '#062b1c',
          900: '#0b3d26',
          800: '#0f4d30',
        },
      },
    },
  },
  plugins: [],
};
