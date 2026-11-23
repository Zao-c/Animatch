import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        anime: {
          bg: "#081121",
          panel: "rgba(15, 23, 42, 0.62)",
          panelStrong: "rgba(15, 23, 42, 0.86)",
          cyan: "#35e6dc",
          pink: "#ff7ab6",
          purple: "#a78bfa",
          amber: "#f6c453",
          danger: "#fb7185",
          muted: "#94a3b8",
          border: "rgba(148, 163, 184, 0.18)"
        }
      },
      borderRadius: {
        anime: "1rem",
        "anime-lg": "1.25rem"
      },
      boxShadow: {
        "anime-panel": "0 16px 44px rgba(2, 6, 23, 0.28)",
        "anime-focus": "0 14px 36px rgba(53, 230, 220, 0.08)",
        "anime-amber": "0 10px 24px rgba(246, 196, 83, 0.08)"
      },
      transitionDuration: {
        anime: "180ms"
      }
    }
  },
  plugins: []
};

export default config;
