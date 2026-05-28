import type { Config } from "tailwindcss";

/**
 * Tailwind CSS configuration.
 *
 * NOTE: This project uses Tailwind v4 which is primarily configured via CSS
 * (@theme in globals.css). This file provides the darkMode strategy and
 * custom colour token extensions for compatibility and tooling support.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // GTM Dashboard palette
        gtm: {
          background: "#0f172a",
          surface: "#1e293b",
          border: "#334155",
          accent: "#f59e0b",
          "accent-alt": "#f97316",
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
          grey: "#64748b",
          blue: "#3b82f6",
          text: "#f1f5f9",
          "text-muted": "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
