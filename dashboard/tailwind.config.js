/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LMCache brand colors (matching official lmcache.ai website)
        'lm-black': '#111',
        'lm-white': '#ffffff',
        'lm-orange': '#ff8342',        // Primary brand color
        'lm-orange-light': '#ffad7a',  // Lighter orange for gradients
        'lm-blue': '#0050bd',          // Secondary brand color
        'lm-blue-light': '#0082f3',    // Lighter blue
        'lm-purple': '#5928e5',        // Legacy purple (keeping for compatibility)
        'lm-purple-light': '#a091f5',
        'lm-gray': '#333',
        'lm-gray-light': '#999',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
