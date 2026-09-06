// Colours come from packages/ui/tokens.json so the Tailwind theme and the
// TypeScript tokens cannot drift apart.
const tokens = require('@mwalimu/ui/tokens.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        xl: `${tokens.radius.xl}px`,
      },
      fontFamily: {
        display: [tokens.fonts.display, 'sans-serif'],
        body: [tokens.fonts.body, 'sans-serif'],
      },
    },
  },
  plugins: [],
};
