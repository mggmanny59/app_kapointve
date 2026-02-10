/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#22C55E", // Green accent
        accent: "#F59E0B", // Amber accent
        "navy-dark": "#0F172A", // Background
        "navy-card": "#1E293B", // Containers
        "slate-subtitle": "#94A3B8",
        border: "#334155"
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"]
      },
      borderRadius: {
        'card': '16px',
        'btn': '12px',
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      }
    },
  },
  plugins: [],
}
