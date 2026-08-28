/** @type {import('tailwindcss').Config} */

/** Token colors resolve per color scheme via the variables in src/global.css. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    // @finance/core ships class names (TYPE_AMOUNT_CLASS), so it has to be
    // scanned too. Without it text-info was never generated and investment
    // amounts fell back to the platform default — black.
    "../../packages/core/src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          hover: token("primary-hover"),
          foreground: token("primary-foreground"),
          ink: token("primary-ink"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        success: {
          DEFAULT: token("success"),
          foreground: token("success-foreground"),
        },
        info: {
          DEFAULT: token("info"),
          foreground: token("info-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        // Hairlines are always translucent; the channels flip per scheme.
        border: "rgb(var(--border) / 0.08)",
        "hairline-strong": "rgb(var(--hairline-strong) / 0.14)",
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
