// Colours come from packages/ui/tokens.json — the OA Design token block ported
// from .claude/skills/oa-design/_root.css — so the Tailwind theme and the
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
