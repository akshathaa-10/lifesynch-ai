/** @type {import('tailwindcss').Config} */
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
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#1e293b',
          800: '#121a22',
          850: '#0e161d',
          900: '#0a1016',
          950: '#060a0e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.95rem' }], // 11px (up from 10px)
        'xs': ['0.8125rem', { lineHeight: '1.2rem' }],    // 13px (up from 12px)
        'sm': ['0.9375rem', { lineHeight: '1.4rem' }],    // 15px (up from 14px)
        'base': ['1.0625rem', { lineHeight: '1.65rem' }], // 17px (up from 16px)
        'lg': ['1.1875rem', { lineHeight: '1.8rem' }],    // 19px (up from 18px)
        'xl': ['1.3125rem', { lineHeight: '1.9rem' }],    // 21px (up from 20px)
        '2xl': ['1.625rem', { lineHeight: '2.15rem' }],   // 26px (up from 24px)
        '3xl': ['2rem', { lineHeight: '2.4rem' }],        // 32px (up from 30px)
        '4xl': ['2.375rem', { lineHeight: '2.8rem' }],    // 38px (up from 36px)
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(20, 184, 166, 0.2)',
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
};
