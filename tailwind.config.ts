import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        anime: {
          bg: "#0c0d10",
          panel: "#14161b",
          panelStrong: "#191c23",
          cyan: "#f4f4f5",
          pink: "#f43f5e",
          purple: "#a1a1aa",
          amber: "#eab308",
          danger: "#fb7185",
          muted: "#9ca3af",
          border: "rgba(255, 255, 255, 0.08)"
        }
      },
      borderRadius: {
        anime: "0.75rem",
        "anime-lg": "1rem"
      },
      boxShadow: {
        "anime-panel": "0 8px 28px rgba(0, 0, 0, 0.32)",
        "anime-focus": "0 12px 32px rgba(0, 0, 0, 0.42)",
        "anime-amber": "0 8px 20px rgba(234, 179, 8, 0.08)"
      },
      transitionDuration: {
        anime: "180ms"
      }
    }
  },
  plugins: []
};

export default config;
