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
          rim: token("primary-rim"),
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
        // 0.10, matching COLORS.border in theme/tokens.ts. The class had been
        // 0.08 while the imperative token was 0.10, so a hairline drawn from
        // JS sat a shade darker than the one beside it drawn from a class.
        border: "rgb(var(--border) / 0.10)",
        "hairline-strong": "rgb(var(--hairline-strong) / 0.14)",
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "12px",
        // Surfaces, named by role rather than by size. A plain card was 16px
        // and a bezelled one 22px inside a 28px shell, so the two forms of the
        // same component did not agree with each other. Both are `card` now,
        // and `shell` stays concentric with it: 26 outer − 6 of bezel padding
        // leaves exactly the 20 the inner surface uses.
        card: "20px",
        shell: "26px",
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
