/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: "#fbfaf7",
        foreground: "#1c1a16",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1c1a16",
        },
        primary: {
          DEFAULT: "#d4af37",
          hover: "#c2992e",
          foreground: "#171100",
          ink: "#7a5f1c",
        },
        secondary: {
          DEFAULT: "#f2efe7",
          foreground: "#1c1a16",
        },
        muted: {
          DEFAULT: "#f2efe7",
          foreground: "#6b6459",
        },
        accent: {
          DEFAULT: "#f7f0d9",
          foreground: "#1c1a16",
        },
        success: {
          DEFAULT: "#16803d",
          foreground: "#ffffff",
        },
        info: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#c23b2e",
          foreground: "#ffffff",
        },
        border: "rgba(28,26,22,0.08)",
        "hairline-strong": "rgba(28,26,22,0.14)",
        "background-dark": "#0b0905",
        "foreground-dark": "#f6efe0",
        "card-dark": "#15100a",
        "border-dark": "rgba(255,246,230,0.08)",
        "hairline-strong-dark": "rgba(255,246,230,0.15)",
        "muted-foreground-dark": "#ab9f86",
        "primary-dark": "#d4af37",
        "primary-hover-dark": "#e0c35c",
        "primary-foreground-dark": "#171100",
        "primary-ink-dark": "#d4af37",
        "secondary-dark": "#1d160d",
        "muted-dark": "#1d160d",
        "success-dark": "#34d399",
        "info-dark": "#60a5fa",
        "destructive-dark": "#f87171",
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "12px",
        none: "0px",
      },
      fontFamily: {
        sans: ["InstrumentSans-Regular"],
        serif: ["Fraunces-Regular"],
        mono: ["IBMPlexMono-Regular"],
        "mono-medium": ["IBMPlexMono-Medium"],
        logo: ["Orbit"],
      },
    },
  },
  plugins: [],
};
