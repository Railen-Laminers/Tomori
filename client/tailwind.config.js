/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        nunito: ["Nunito", "sans-serif"],
        fredoka: ["Fredoka One", "cursive"],
        // Add the retro fonts we use in the UI
        vt323: ["VT323", "monospace"],
        special: ["Special Elite", "cursive"],
        share: ["Share Tech Mono", "monospace"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.7)" },
        },
        titleFlicker: {
          "0%, 100%": { opacity: "1" },
          "91%": { opacity: "1" },
          "92%": { opacity: "0.82" },
          "93%": { opacity: "1" },
          "95%": { opacity: "0.88" },
          "96%": { opacity: "1" },
        },
        onlinePulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.3", transform: "scale(0.65)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.35s ease forwards",
        pulse: "pulse 2.5s ease-in-out infinite",
        titleFlicker: "titleFlicker 9s ease-in-out infinite",
        onlinePulse: "onlinePulse 2.5s ease-in-out infinite",
        fadeIn: "fadeIn 0.25s ease forwards",
      },
    },
  },
  plugins: [],
};