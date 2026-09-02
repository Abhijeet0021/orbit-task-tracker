import plugin from 'tailwindcss/plugin';
import animate from 'tailwindcss-animate';

/**
 * The markup in this project is written in Tailwind v4 class names while the
 * project runs Tailwind 3.x. The theme extensions below re-create the v4
 * utilities that v3 has no equivalent for, so the styling that was written
 * actually compiles. See docs/decisions.md.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      // v4 renamed the shadow scale: its `xs` is v3's `sm`, and it added `2xs`.
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '2xs': '0 1px 0 0 rgb(0 0 0 / 0.05)',
      },
      scale: {
        '102': '1.02',
      },
      spacing: {
        '0.2': '0.05rem',
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [
    animate,
    plugin(({ addUtilities }) => {
      addUtilities({
        // v4's outline-hidden. Twenty-one of the elements using it define no
        // focus style of their own, so rather than suppressing the outline
        // outright, keep it transparent and colour it for keyboard focus -
        // pointer users see nothing, keyboard users always get a ring.
        '.outline-hidden': {
          outline: '2px solid transparent',
          'outline-offset': '2px',
        },
        '.outline-hidden:focus-visible': {
          'outline-color': '#3b82f6',
        },
      });
    }),
  ],
}
