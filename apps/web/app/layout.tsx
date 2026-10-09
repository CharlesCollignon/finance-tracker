import type { Metadata, Viewport } from "next";
// Each of these declares its own custom property rather than writing straight
// into --font-sans/-serif/-mono. globals.css also sets those three, on a
// selector of equal specificity and later in the sheet, so it won a cascade it
// was not meant to be in — and its hand-written stack dropped the
// "… Fallback" face next/font generates. That face is metric-matched to the
// real one, and it is what stops the hero figure jumping when the webfont
// swaps in. globals.css now composes these instead.
//
// The files are in `app/fonts`, not fetched from Google at build time.
// Google Fonts sometimes answers next/font/google with `/l/font?kit=…&…`
// URLs, which Turbopack splits at the `&`, and the build fails — it took a
// production deploy down on 2026-10-09 on code a preview had just built.
// These are the same latin files Google served, OFL licences beside them.
import localFont from "next/font/local";
import "./globals.css";
import { getLocale } from "@/lib/locale";
import { LocaleProvider } from "@/lib/locale-context";
import { getCurrency } from "@/lib/currency";
import { CurrencyProvider } from "@/lib/use-currency";
import { LocaleSuggestion } from "@/components/layout/LocaleSuggestion";

const instrumentSans = localFont({
  src: "./fonts/instrument-sans-latin.woff2",
  variable: "--font-instrument-sans",
  weight: "400 700",
  display: "swap",
});

const fraunces = localFont({
  src: [
    {
      path: "./fonts/fraunces-latin.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-italic-latin.woff2",
      weight: "400 600",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
  // A serif: its metric-matched fallback is built on Times New Roman, as
  // next/font/google built it.
  adjustFontFallback: "Times New Roman",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-latin.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-500-latin.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-mono-600-latin.woff2", weight: "600" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pluclair",
  // The landing hero's tagline verbatim. This is the sentence search results
  // and link previews show, so the two have to agree — which is the whole
  // reason it has now been corrected twice. It first advertised having no
  // bank connection, long after one was designed; then it advertised reading
  // from your bank, which no visitor can actually do: `lib/bank/client.ts`
  // answers for one owner user id and the per-user path is still a seam. It
  // now says what someone arriving today will do, and nothing else.
  description:
    "Income, bills, savings and investments — recorded by you, held privately, and reconciled against your real balance at the end of every month.",
  // iOS ignores the web manifest for these, so they have to be stated here
  // for an installed app to open without browser chrome.
  appleWebApp: {
    capable: true,
    title: "Pluclair",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // One colour, because there is one theme. Pluclair is dark: the figures
  // are the brightest thing on the screen and the veil behind them only
  // reads on a dark ground.
  themeColor: "#0a0a10",
  colorScheme: "dark",
};

const privacyInitScript = `(function(){try{document.documentElement.dataset.privacy=localStorage.getItem("privacy-blur")==="1"?"on":"off";}catch(e){document.documentElement.dataset.privacy="off";}})();`;

/**
 * How wide the room kept for the scrollbar is (`scrollbar-gutter` in
 * globals.css), as `--scrollbar-gutter`: the bezel takes it on the other
 * three sides so the window is framed evenly. CSS cannot read it, and it
 * depends on the browser and the zoom — about 10px for a thin bar, nothing
 * where the bar floats — so it is measured, and again whenever the window
 * or the zoom changes.
 *
 * Measured as the window less the root's own box, which the room is kept
 * out of whether or not a scrollbar is drawn in it. Not `clientWidth`,
 * which only leaves out a scrollbar actually drawn — none on a page too
 * short to scroll, nor on any page this early.
 *
 * At the top of the body rather than in the head: an inline script there
 * waits for the stylesheets before it, so the room it measures is kept,
 * and it still runs before anything is painted.
 */
const scrollbarGutterScript = `(function(){var d=document.documentElement;function m(){d.style.setProperty("--scrollbar-gutter",Math.max(0,Math.round(window.innerWidth-d.getBoundingClientRect().width))+"px");}m();window.addEventListener("resize",m);})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading a cookie makes this layout dynamic, which costs nothing here:
  // both group layouts below already call `getAuthUser()`, so every route in
  // the app was dynamic before this line existed.
  const [locale, currency] = await Promise.all([getLocale(), getCurrency()]);

  return (
    // `dark` is rendered on the server rather than applied by a script, so
    // there is no flash of the wrong theme and no blocking script in the
    // head. The class stays — the tokens do not need it, but a few dozen
    // `dark:` utilities across the app resolve against it.
    <html
      lang={locale}
      className={`dark ${instrumentSans.variable} ${fraunces.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: privacyInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: scrollbarGutterScript }} />
        <LocaleProvider locale={locale}>
          <CurrencyProvider currency={currency}>
            <LocaleSuggestion />
            {children}
          </CurrencyProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
