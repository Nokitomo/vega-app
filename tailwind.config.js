/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: require('./src/lib/themeColors.json').defaultPrimary,
        secondary: '#000000',
        tertiary: '#171717',
        quaternary: '#1a1a1a',
      },
    },
  },
  plugins: [],
};
