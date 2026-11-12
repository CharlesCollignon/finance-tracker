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
import { getSiteUrl } from "@/lib/supabase/env";
import { getDesign } from "@/lib/design";
import { DesignProvider } from "@/lib/design-context";
import { isLightDesign, type Design } from "@finance/core/designs";
import { readAudienceMeasurement } from "@finance/data/preferences";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { VercelMeasurement } from "@/components/layout/VercelMeasurement";

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

// The faces only the other designs set their figures and headings in
// (`packages/core/src/designs.ts`): « Papier » in Newsreader, « Bento » in
// Bricolage Grotesque. Not preloaded — a browser fetches a declared face only
// when something on the page is set in it, so a reader in « Nuit » never
// downloads either.
const newsreader = localFont({
  src: "./fonts/newsreader-latin.woff2",
  variable: "--font-newsreader",
  weight: "200 800",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // What a page's relative addresses resolve against: its canonical link and
  // its Open Graph image (`lib/og`), which a crawler needs whole.
  metadataBase: new URL(getSiteUrl()),
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

/**
 * The browser's own chrome — the phone's status bar, an installed app's
 * title bar — in the ground of the reader's design, so it never shows a
 * near-black strip over paper. Each matches `--background` in globals.css.
 */
const DESIGN_GROUND: Record<Design, string> = {
  nuit: "#0a0a10",
  papier: "#f6f1e7",
  bento: "#eef0f3",
  console: "#0b0b0b",
};

export async function generateViewport(): Promise<Viewport> {
  const design = await getDesign();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: DESIGN_GROUND[design],
    colorScheme: isLightDesign(design) ? "light" : "dark",
  };
}

const privacyInitScript = `(function(){try{document.documentElement.dataset.privacy=localStorage.getItem("privacy-blur")==="1"?"on":"off";}catch(e){document.documentElement.dataset.privacy="off";}})();`;

/**
 * Whether Vercel Web Analytics and Speed Insights run on this page: the
 * signed-in person's « Mesure d'audience », and on for a visitor without an
 * account, who has no switch to turn. The app and marketing layouts already
 * ask who is signed in, and `getAuthUser` is cached for the request, so this
 * adds one read, for someone signed in. When it fails, nothing is measured: a page view
 * missed is nothing, one counted against someone's wish is not.
 */
async function isMeasured(): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) {
    return true;
  }
  return readAudienceMeasurement(await createClient(), user.id).catch(
    () => false,
  );
}

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
  const [locale, currency, design, measured] = await Promise.all([
    getLocale(),
    getCurrency(),
    getDesign(),
    isMeasured(),
  ]);

  return (
    // The design is rendered on the server rather than applied by a script,
    // so there is no flash of the wrong one and no blocking script in the
    // head: `data-design` picks the palette in globals.css, and `dark` stays
    // on the dark designs for the `dark:` utilities that resolve against it.
    <html
      lang={locale}
      data-design={design}
      className={`${isLightDesign(design) ? "" : "dark "}${instrumentSans.variable} ${fraunces.variable} ${plexMono.variable} ${newsreader.variable} ${bricolage.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: privacyInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: scrollbarGutterScript }} />
        <LocaleProvider locale={locale}>
          <CurrencyProvider currency={currency}>
            <DesignProvider design={design}>
              <LocaleSuggestion />
              {children}
            </DesignProvider>
          </CurrencyProvider>
        </LocaleProvider>
        <VercelMeasurement on={measured} />
      </body>
    </html>
  );
}
