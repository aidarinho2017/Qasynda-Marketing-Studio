import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef5f3',
          100: '#d4e8e3',
          200: '#a8d1c7',
          300: '#75b5a8',
          400: '#559988',
          500: '#487b6a',
          600: '#487b6a',
          700: '#3a6357',
          800: '#2d4c43',
          900: '#1e3329',
        },
      },
    },
  },
  plugins: [],
};

export default config;
