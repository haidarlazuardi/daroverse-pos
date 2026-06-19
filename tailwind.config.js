/** @type {import('tailwindcss').Config} */
// Soeka House brand palette — forest green #48654D + cream #F6EDDB
const soeka = {
  50: '#F0F4F0',
  100: '#DDE6DE',
  200: '#BCCCBE',
  300: '#95AE99',
  400: '#6E8E74',
  500: '#557A5C',
  600: '#48654D', // brand base (logo green)
  700: '#3C5440',
  800: '#314434',
  900: '#28362B',
  950: '#16201A',
};
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // brand + green both point to the Soeka forest ramp so every
        // green-* / brand-* utility across the app reskins at once
        brand: soeka,
        green: soeka,
        emerald: soeka,
        cream: { DEFAULT: '#F6EDDB', light: '#F7F2E7', dark: '#ECE1C7' },
        // warm the large background surfaces toward cream; keep mid/dark neutral for contrast
        gray: { 50: '#F7F2E7' },
        surface: {
          0: '#ffffff',
          50: '#F7F2E7',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};
