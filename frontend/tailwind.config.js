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
          orange: '#FFA116',
          'orange-dark': '#E08D00',
          'orange-light': '#FFB84D',
        },
        dark: {
          900: '#0F0F0F',
          800: '#1A1A1A',
          700: '#242424',
          600: '#2E2E2E',
          500: '#3A3A3A',
          400: '#4A4A4A',
        },
        success: '#00B8A3',
        danger: '#EF4743',
        warning: '#FFB800',
        info: '#5AB2FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 50%, #1A0A00 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,161,22,0.05) 0%, rgba(255,161,22,0) 100%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      },
      boxShadow: {
        'orange': '0 0 20px rgba(255, 161, 22, 0.3)',
        'orange-sm': '0 0 10px rgba(255, 161, 22, 0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
      borderColor: {
        'dark': 'rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}
