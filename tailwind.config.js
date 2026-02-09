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
        primary: "#39E079",
        accent: "#ff8c00",
        "navy-dark": "#0a121e",
        "navy-card": "#162235",
        "background-light": "#f6f8f7",
        "background-dark": "#0a121e"
      },
      fontFamily: {
        display: ["Work Sans", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      }
    },
  },
  plugins: [],
}
