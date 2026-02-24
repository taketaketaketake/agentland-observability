/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        mobile: { max: '640px' },
        short: { raw: '(max-height: 500px)' },
      },
    },
  },
  plugins: [],
};
