import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mautic design system colors
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Primary backgrounds - Mautic light theme with dark sidebar
        'bg-primary': '#f5f5f5',      // Light gray page background
        'bg-secondary': '#ffffff',     // White card backgrounds
        'bg-tertiary': '#e8e8e8',      // Slightly darker for hover states
        'sidebar': '#1c2541',          // Dark blue sidebar

        // Borders
        'border-subtle': '#e0e0e0',
        'border-hover': '#4e5d9d',

        // Text
        'text-primary': '#333333',     // Dark text on light backgrounds
        'text-secondary': '#666666',
        'text-muted': '#999999',
        'text-light': '#ffffff',       // For dark backgrounds like sidebar

        // Accent colors - Mautic blue theme
        'accent-cyan': '#4e5d9d',      // Primary Mautic purple-blue
        'accent-purple': '#6c5ce7',    // Secondary purple
        'accent-green': '#00b49c',     // Mautic success green
        'accent-red': '#d32f2f',       // Mautic error red
        'accent-yellow': '#f7941d',    // Mautic warning orange

        // Additional Mautic colors
        'mautic-blue': '#4e5d9d',
        'mautic-blue-light': '#1a8cff',
        'mautic-blue-dark': '#1c2541',

        // Semantic colors
        'success': '#00b49c',
        'warning': '#f7941d',
        'error': '#d32f2f',
        'info': '#1a8cff',

        // Monday.com-inspired status colors
        'status': {
          'done': '#00C875',       // Green - Completed
          'working': '#FDAB3D',    // Orange - In Progress
          'stuck': '#E2445C',      // Red - Blocked/Stuck
          'pending': '#C4C4C4',    // Gray - Not Started
          'review': '#579BFC',     // Blue - In Review
          'planning': '#A25DDC',   // Purple - Planning
          'hot': '#FF5AC4',        // Pink - Hot Lead
          'cold': '#66CCFF',       // Light Blue - Cold Lead
        },
      },
      fontFamily: {
        sans: ['Open Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.5rem',
        '2xl': '0.75rem',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(78, 93, 157, 0.3)',
        'glow-purple': '0 0 20px rgba(108, 92, 231, 0.3)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 16px rgba(78, 93, 157, 0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
