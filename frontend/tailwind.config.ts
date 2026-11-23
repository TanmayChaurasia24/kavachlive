import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        safety: {
          amber: "#f59e0b",
          red: "#ef4444",
          green: "#10b981",
          blue: "#3b82f6",
          dark: "#0f172a",
          card: "#1e293b",
          border: "#334155",
        },
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseAlert: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.02)" },
        },
      },
      animation: {
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-alert": "pulseAlert 1.5s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
