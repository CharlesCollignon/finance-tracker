/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#0a0a0a",
        card: {
          DEFAULT: "#fafafa",
          foreground: "#0a0a0a",
        },
        primary: {
          DEFAULT: "#c9a05a",
          hover: "#b8904a",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f4f4f5",
          foreground: "#0a0a0a",
        },
        muted: {
          DEFAULT: "#f4f4f5",
          foreground: "#71717a",
        },
        accent: {
          DEFAULT: "#f5f0e8",
          foreground: "#0a0a0a",
        },
        success: {
          DEFAULT: "#16a34a",
          foreground: "#ffffff",
        },
        info: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        border: "#e4e4e7",
        "background-dark": "#0a0a0a",
        "foreground-dark": "#fafafa",
        "card-dark": "#141414",
        "border-dark": "#27272a",
        "muted-foreground-dark": "#a1a1aa",
        "primary-dark": "#dbb87a",
        "success-dark": "#34d399",
        "info-dark": "#60a5fa",
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "12px",
        none: "0px",
      },
    },
  },
  plugins: [],
};
