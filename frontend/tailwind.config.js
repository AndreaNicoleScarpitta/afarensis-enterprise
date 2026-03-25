/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Brand color palette
      colors: {
        // Named brand tokens
        brand: {
          obsidian: '#1A1A1B',
          cobalt: '#2563EB',
          'clinical-white': '#F9FAFB',
          slate: '#E5E7EB',
        },

        // Primary colors — Cobalt (#2563EB) as anchor
        primary: {
          25: '#f0f6ff',
          50: '#e8f1fe',
          100: '#d1e3fd',
          200: '#a8cafc',
          300: '#76aaf9',
          400: '#4d8af5',
          500: '#3b72f0',
          600: '#2563EB',  // Cobalt
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },

        // Secondary colors — grays anchored to Obsidian / Clinical White / Slate
        gray: {
          25: '#fdfdfd',
          50: '#F9FAFB',   // Clinical White
          100: '#f3f4f6',
          200: '#E5E7EB',  // Slate
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#1A1A1B',  // Obsidian
          950: '#0d0d0e',
        },
        
        // Success colors - Regulatory approval green
        success: {
          25: '#f6fef9',
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#6ce9a6',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
          800: '#05603a',
          900: '#054f31',
          950: '#022c1b',
        },
        
        // Warning colors - Regulatory caution amber
        warning: {
          25: '#fffcf5',
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fedf89',
          300: '#fec84b',
          400: '#fdb022',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
          800: '#93370d',
          900: '#7a2e0e',
          950: '#4e1d09',
        },
        
        // Error colors - Critical regulatory red  
        error: {
          25: '#fffbfa',
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          300: '#fda29b',
          400: '#f97066',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
          800: '#912018',
          900: '#7a271a',
          950: '#55160c',
        },
        
        // Info colors - Data insight blue
        info: {
          25: '#f5faff',
          50: '#eff8ff',
          100: '#d1e9ff',
          200: '#b2ddff',
          300: '#84caff',
          400: '#53b1fd',
          500: '#2e90fa',
          600: '#1570ef',
          700: '#175cd3',
          800: '#1849a9',
          900: '#194185',
          950: '#102a56',
        },
      },
      
      // Typography scale for regulatory documents
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      
      // Professional spacing scale
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      
      // Enterprise layout utilities
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      
      // Professional shadows
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'regulatory': '0 4px 12px 0 rgb(0 0 0 / 0.05)',
      },
      
      // Professional border radius
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      // Animation for professional interactions
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      
      // Professional breakpoints for enterprise screens
      screens: {
        '3xl': '1792px',
      },
    },
  },
  plugins: [
    // shadcn/ui animation plugin
    require('tailwindcss-animate'),

    // Form styling plugin for professional forms
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),

    // Typography plugin for regulatory documents
    require('@tailwindcss/typography'),
    
    // Custom component classes
    function({ addComponents, theme }) {
      addComponents({
        // Professional button styles
        '.btn': {
          '@apply inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50': {},
        },
        '.btn-primary': {
          '@apply bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500': {},
        },
        '.btn-secondary': {
          '@apply bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500': {},
        },
        
        // Professional headings
        '.heading-1': {
          '@apply text-4xl lg:text-5xl font-bold tracking-tight text-gray-900': {},
        },
        '.heading-2': {
          '@apply text-3xl lg:text-4xl font-bold tracking-tight text-gray-900': {},
        },
        '.heading-3': {
          '@apply text-2xl lg:text-3xl font-bold tracking-tight text-gray-900': {},
        },
        '.heading-4': {
          '@apply text-xl lg:text-2xl font-semibold tracking-tight text-gray-900': {},
        },
        
        // Professional body text
        '.body-large': {
          '@apply text-lg text-gray-700 leading-relaxed': {},
        },
        '.body-normal': {
          '@apply text-base text-gray-600 leading-normal': {},
        },
        '.body-small': {
          '@apply text-sm text-gray-500 leading-normal': {},
        },
        
        // Layout utilities
        '.layout-container': {
          '@apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8': {},
        },
        '.layout-content': {
          '@apply p-6 lg:p-8': {},
        },
        
        // Professional cards
        '.card': {
          '@apply bg-white rounded-lg shadow-sm border border-gray-200': {},
        },
        '.card-header': {
          '@apply p-6 border-b border-gray-200': {},
        },
        '.card-body': {
          '@apply p-6': {},
        },
        '.card-footer': {
          '@apply p-6 border-t border-gray-200': {},
        },
      })
    }
  ],
}
