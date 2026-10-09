import type { Metadata, Viewport } from "next";
// Each of these declares its own custom property rather than writing straight
// into --font-sans/-serif/-mono. globals.css also sets those three, on a
// selector of equal specificity and later in the sheet, so it won a cascade it
// was not meant to be in — and its hand-written stack dropped the
// "… Fallback" face next/font generates. That face is metric-matched to the
// real one, and it is what stops the hero figure jumping when the webfont
// swaps in. globals.css now composes these instead.
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/locale";
import { LocaleProvider } from "@/lib/locale-context";
import { getCurrency } from "@/lib/currency";
import { CurrencyProvider } from "@/lib/use-currency";
import { LocaleSuggestion } from "@/components/layout/LocaleSuggestion";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
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
