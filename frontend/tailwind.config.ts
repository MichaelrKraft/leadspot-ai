import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Professional blue tones for enterprise
        primary: {
          50: "#E6F0FF",
          100: "#B3D4FF",
          200: "#80B8FF",
          300: "#4D9CFF",
          400: "#1A80FF",
          500: "#0066E6",
          600: "#0052B3",
          700: "#003D80",
          800: "#00294D",
          900: "#001A33",
        },
        // Dark background tones - Softer, less harsh
        background: {
          DEFAULT: "#111318",
          secondary: "#181B22",
          tertiary: "#1F232B",
        },
        // Light background tones
        "background-light": {
          DEFAULT: "#F9FAFB",
          secondary: "#FFFFFF",
          tertiary: "#F3F4F6",
        },
        // Accent colors - Softer blues
        accent: {
          blue: "#1E3A5F",
          darkBlue: "#1A2D45",
          lightBlue: "#3B5A7F",
        },
        // Semantic colors
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(30, 58, 95, 0.5)",
        "glow-lg": "0 0 40px rgba(30, 58, 95, 0.6)",
        "glow-light": "0 0 20px rgba(59, 130, 246, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
