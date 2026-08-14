import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#238FCA',
          50: '#EEF8FC',
          100: '#D9F0F9',
          200: '#B8E1F2',
          500: '#238FCA',
          600: '#1678B2',
          700: '#135F8C',
          900: '#163A50',
        },
        secondary: {
          DEFAULT: '#7967A9',
          50: '#F6F3FA',
          100: '#ECE7F5',
          200: '#D8CFEB',
          500: '#7967A9',
          600: '#66558F',
          700: '#524574',
        },
        accent: {
          green: '#238B72',
          red: '#D9655A',
          gold: '#C99516',
          coral: '#E57867',
          mint: '#DDF5EC',
          sky: '#E4F4FB',
        },
        ink: '#17253A',
        surface: '#FFFFFF',
        cloud: '#F7F8FB',
        bg: '#EEF2F6',
        success: '#238B72',
        warning: '#A97114',
        error: '#C95055',
      },
      fontFamily: {
        arabic: ['var(--font-almarai)', 'var(--font-cairo)', 'system-ui'],
        heading: ['var(--font-cairo)', 'var(--font-almarai)', 'system-ui'],
        body: ['var(--font-almarai)', 'var(--font-cairo)', 'system-ui'],
      },
      borderRadius: {
        'xs': '6px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '28px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(23, 37, 58, 0.04), 0 10px 30px rgba(23, 37, 58, 0.06)',
        'hover': '0 16px 36px rgba(35, 143, 202, 0.14)',
        'lg': '0 24px 56px rgba(23, 37, 58, 0.14)',
      },
      animation: {
        'card-in': 'card-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'celebrate': 'celebrate 650ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        'card-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        celebrate: {
          '0%': { opacity: '0', transform: 'translateY(10px) rotate(-3deg) scale(0.9)' },
          '70%': { opacity: '1', transform: 'translateY(-2px) rotate(1deg) scale(1.03)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0) scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}

export default config
