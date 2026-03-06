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
        primary: "rgb(255, 101, 14)",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        "bg-light": "rgb(240, 242, 245)",
        "card-white": "#FFFFFF",
        "slate-subtitle": "#64748b",
        border: "#e2e8f0"
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
