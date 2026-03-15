/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f2b46',
          dark: '#0b2236',
          light: '#e7eef4',
          wash: '#f2f6fa',
          border: '#d5e1eb',
          mid: '#1d4565',
        },
        terra: {
          DEFAULT: '#c86b4a',
          dark: '#b85f3f',
          wash: '#fff8f4',
        },
        forest: {
          DEFAULT: '#4c7c59',
          wash: '#eaf3ee',
        },
        gold: {
          DEFAULT: '#f4c317',
        },
        streak: {
          DEFAULT: '#6b46c1',
          wash: '#f7f4ff',
        },
        page: {
          DEFAULT: '#f9fafb',
        },
        ink: {
          DEFAULT: '#1f2933',
          dark: '#111827',
        },
        danger: {
          DEFAULT: '#c53030',
        },
      },
    },
  },
  plugins: [],
};

export default config;
