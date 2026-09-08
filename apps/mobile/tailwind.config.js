// Colours, radii and fonts come from packages/ui/tokens.json — the single
// source the TypeScript tokens also read — so the Tailwind theme and the
// typed palette cannot drift apart. Add a colour there, not here.
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
        '2xl': `${tokens.radius.xl2}px`,
        '3xl': `${tokens.radius.xl3}px`,
        '4xl': `${tokens.radius.xl4}px`,
        full: '999px',
      },
      fontFamily: {
        // Inter Tight, weight range 300-500. The ceiling is the identity.
        sans: [tokens.fonts.sans, 'system-ui', 'sans-serif'],
        mono: [tokens.fonts.mono, 'monospace'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
      },
    },
  },
  plugins: [],
};
