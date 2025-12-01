/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        // Precision Control Center palette
        void: {
          DEFAULT: '#0a0a0b',
          deep: '#050506',
          surface: '#111113',
          elevated: '#18181b',
        },
        amber: {
          glow: '#fbbf24',
          bright: '#f59e0b',
          muted: '#d97706',
          dim: '#92400e',
        },
        cyan: {
          data: '#22d3ee',
          bright: '#06b6d4',
          muted: '#0891b2',
        },
        signal: {
          success: '#22c55e',
          warning: '#eab308',
          error: '#ef4444',
          info: '#3b82f6',
        },
        steel: {
          50: '#fafafa',
          100: '#e4e4e7',
          200: '#d4d4d8',
          300: '#a1a1aa',
          400: '#71717a',
          500: '#52525b',
          600: '#3f3f46',
          700: '#27272a',
          800: '#1c1c1f',
          900: '#131315',
        },
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'display-lg': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-md': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'grid-flow': 'gridFlow 20s linear infinite',
        'particle-float': 'particleFloat 6s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
        'data-stream': 'dataStream 2s linear infinite',
        'converge': 'converge 3s ease-out infinite',
        'typing': 'typing 3.5s steps(40, end), blink-caret 0.75s step-end infinite',
        'count-up': 'countUp 0.4s ease-out forwards',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        gridFlow: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(50px)' },
        },
        particleFloat: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(-5px) translateX(-5px)' },
          '75%': { transform: 'translateY(-15px) translateX(3px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        dataStream: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        converge: {
          '0%': { transform: 'scale(1.5)', opacity: '0' },
          '50%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'blink-caret': {
          'from, to': { borderColor: 'transparent' },
          '50%': { borderColor: '#fbbf24' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        borderGlow: {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(251, 191, 36, 0.3), inset 0 0 5px rgba(251, 191, 36, 0.1)'
          },
          '50%': {
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.5), inset 0 0 10px rgba(251, 191, 36, 0.2)'
          },
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(251, 191, 36, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(251, 191, 36, 0.03) 1px, transparent 1px)`,
        'grid-pattern-dense': `linear-gradient(rgba(251, 191, 36, 0.05) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(251, 191, 36, 0.05) 1px, transparent 1px)`,
        'radial-glow': 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
        'radial-glow-cyan': 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
        'noise': `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      },
      backgroundSize: {
        'grid-sm': '20px 20px',
        'grid-md': '40px 40px',
        'grid-lg': '80px 80px',
      },
      boxShadow: {
        'glow-amber': '0 0 30px rgba(251, 191, 36, 0.3)',
        'glow-amber-sm': '0 0 15px rgba(251, 191, 36, 0.2)',
        'glow-cyan': '0 0 30px rgba(34, 211, 238, 0.3)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.4)',
        'inner-glow': 'inset 0 0 30px rgba(251, 191, 36, 0.1)',
        'panel': '0 4px 30px rgba(0, 0, 0, 0.5)',
      },
      borderWidth: {
        '0.5': '0.5px',
      },
    },
  },
  plugins: [],
};
