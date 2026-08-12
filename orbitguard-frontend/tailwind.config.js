/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          bg: '#020617',      // Slate 950 (Space Dark)
          panel: '#0B1528',   // Space Deep Blue
          border: '#1E293B',  // Slate 800
          glow: '#2563EB',    // Blue 600
        }
      }
    },
  },
  plugins: [],
}
