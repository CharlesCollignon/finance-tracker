/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#000000",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#000000",
        },
        primary: {
          DEFAULT: "#ffdb33",
          hover: "#ffcc00",
          foreground: "#000000",
        },
        secondary: {
          DEFAULT: "#000000",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#aeaeae",
          foreground: "#5a5a5a",
        },
        accent: {
          DEFAULT: "#fae583",
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "#e63946",
          foreground: "#ffffff",
        },
        border: "#000000",
      },
      borderRadius: {
        // Neo-brutalist: square corners everywhere.
        none: "0px",
        DEFAULT: "0px",
      },
    },
  },
  plugins: [],
};
