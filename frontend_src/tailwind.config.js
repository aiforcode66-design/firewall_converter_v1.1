/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        display: ['"Montserrat"', 'sans-serif'], // For headers if needed
      },
      colors: {
        brand: {
          50: '#FDF2F4',   // Very subtle pink-white
          100: '#FBE0E4',  // Light rose
          200: '#F5C2CB',  // Rose
          300: '#EB94A5',  // Darker rose
          400: '#D6536D',  // Light red
          500: '#8E1F2F',  // Primary - Roma Red (Imperial Purple)
          600: '#751926',  // Darker Red
          700: '#5E141F',  // Deep Red
          800: '#4A1019',  // Burgundian
          900: '#3D0D15',  // Darkest
        },
        accent: {
          50: '#FEFCE8',
          100: '#FFF7C2',
          200: '#FFEFA0',
          300: '#FFE270',
          400: '#F0BC42',  // Roma Yellow / Gold
          500: '#E0A82E',  // Darker Gold
          600: '#B8821B',
          700: '#916310',
          800: '#734D10',
          900: '#614013',
        },
        white: {
          DEFAULT: '#ffffff',
          off: '#FAFAF9',  // Warm neutral
          cream: '#FFFBF5',
        },
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      boxShadow: {
        'brand': '0 4px 20px -2px rgba(142, 31, 47, 0.15)',
        'brand-lg': '0 10px 40px -4px rgba(142, 31, 47, 0.2)',
        'brand-glow': '0 0 20px rgba(142, 31, 47, 0.25)',
        'soft': '0 2px 10px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8E1F2F 0%, #5E141F 100%)',
        'gradient-brand-subtle': 'linear-gradient(135deg, #FDF2F4 0%, #FBE0E4 100%)',
        'gradient-accent': 'linear-gradient(135deg, #F0BC42 0%, #E0A82E 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
