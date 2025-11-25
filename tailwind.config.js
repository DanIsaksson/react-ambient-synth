/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ===========================================
      // NEON-ORGANIC COLOR PALETTE
      // ===========================================
      colors: {
        // Obsidian Backgrounds
        obsidian: {
          DEFAULT: '#050505',
          50: '#121212',
          100: '#0a0a0f',
          200: '#1a1a1f',
          300: '#252530',
        },
        // Glass Panel
        glass: {
          DEFAULT: 'rgba(20, 20, 20, 0.6)',
          dark: 'rgba(10, 10, 10, 0.8)',
          light: 'rgba(40, 40, 40, 0.4)',
        },
        // Neon Accents
        neon: {
          green: '#00ff88',   // Signal - Active Audio
          cyan: '#00ccff',    // Control - Modulation
          red: '#ff0055',     // Warning - Clip/Error
          purple: '#a855f7',  // Accent - Secondary
          orange: '#ff8800',  // Warm - Envelope
        },
        // Idle/Muted States
        muted: {
          DEFAULT: '#444444',
          dark: '#2a2a2a',
          light: '#666666',
        },
      },

      // ===========================================
      // NEON GLOW BOX SHADOWS
      // ===========================================
      boxShadow: {
        // Primary Neon Glows
        'neon-green': '0 0 5px #00ff88, 0 0 20px rgba(0, 255, 136, 0.5)',
        'neon-green-lg': '0 0 10px #00ff88, 0 0 40px rgba(0, 255, 136, 0.6), 0 0 80px rgba(0, 255, 136, 0.3)',
        'neon-cyan': '0 0 5px #00ccff, 0 0 20px rgba(0, 204, 255, 0.5)',
        'neon-cyan-lg': '0 0 10px #00ccff, 0 0 40px rgba(0, 204, 255, 0.6), 0 0 80px rgba(0, 204, 255, 0.3)',
        'neon-red': '0 0 5px #ff0055, 0 0 20px rgba(255, 0, 85, 0.5)',
        'neon-red-lg': '0 0 10px #ff0055, 0 0 40px rgba(255, 0, 85, 0.6), 0 0 80px rgba(255, 0, 85, 0.3)',
        'neon-purple': '0 0 5px #a855f7, 0 0 20px rgba(168, 85, 247, 0.5)',
        'neon-orange': '0 0 5px #ff8800, 0 0 20px rgba(255, 136, 0, 0.5)',

        // Glassmorphism Shadows
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        
        // Interactive Shadows
        'inset-glow-green': 'inset 0 0 20px rgba(0, 255, 136, 0.3)',
        'inset-glow-cyan': 'inset 0 0 20px rgba(0, 204, 255, 0.3)',
      },

      // ===========================================
      // TYPOGRAPHY - FUTURISTIC FONTS
      // ===========================================
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],         // Headers - Tech/Futuristic
        'mono': ['Share Tech Mono', 'monospace'],      // Labels - Technical
        'body': ['Inter', 'sans-serif'],               // Body - Readable
        'rajdhani': ['Rajdhani', 'sans-serif'],        // Alt labels
      },

      // ===========================================
      // ANIMATIONS
      // ===========================================
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-breathe': 'glow-breathe 3s ease-in-out infinite',
        'flicker': 'flicker 0.15s ease-in-out infinite',
        'signal-flow': 'signal-flow 1.5s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'ripple': 'ripple 0.6s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 5px #00ff88, 0 0 20px rgba(0, 255, 136, 0.3)' 
          },
          '50%': { 
            boxShadow: '0 0 10px #00ff88, 0 0 40px rgba(0, 255, 136, 0.6)' 
          },
        },
        'glow-breathe': {
          '0%, 100%': { 
            opacity: '0.6',
            filter: 'brightness(1)'
          },
          '50%': { 
            opacity: '1',
            filter: 'brightness(1.2)'
          },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'signal-flow': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-20' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },

      // ===========================================
      // SPACING & SIZING
      // ===========================================
      borderRadius: {
        'organic': '16px',
        'pill': '9999px',
      },
      backdropBlur: {
        'glass': '12px',
        'glass-lg': '20px',
      },
    },
  },
  plugins: [],
}
