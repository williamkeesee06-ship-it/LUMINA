import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tactical luxury palette — dark cosmic with neon telemetry
        void: {
          DEFAULT: "#03060B",
          deep: "#000104",
          near: "#0A0F1A",
        },
        steel: {
          900: "#0E1420",
          800: "#141B2B",
          700: "#1B2436",
          600: "#243046",
          500: "#34425C",
          400: "#5A6985",
        },
        cyan: {
          glow: "#5BF3FF",
          core: "#00D9F5",
          deep: "#0496B0",
          dim: "#0A4955",
        },
        teal: {
          glow: "#3CFFD2",
          core: "#00C9A7",
          dim: "#0F4D45",
        },
        magenta: {
          signal: "#FF3D9A",
          core: "#FF1F8A",
          dim: "#5C0A38",
        },
        red: {
          alert: "#FF5151",
          dim: "#4A1414",
        },
        amber: {
          warn: "#FFB347",
          dim: "#4A2D0F",
        },
      },
      fontFamily: {
        display: ['"Rajdhani"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tactical: "0.18em",
        wide: "0.08em",
      },
      animation: {
        "orb-pulse": "orb-pulse 3.4s ease-in-out infinite",
        "scan-sweep": "scan-sweep 6s linear infinite",
        "telemetry-flicker": "telemetry-flicker 4s ease-in-out infinite",
        "ring-rotate": "ring-rotate 22s linear infinite",
      },
      keyframes: {
        "orb-pulse": {
          "0%,100%": { transform: "scale(1)", opacity: "0.92" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "telemetry-flicker": {
          "0%,98%,100%": { opacity: "1" },
          "99%": { opacity: "0.6" },
        },
        "ring-rotate": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
