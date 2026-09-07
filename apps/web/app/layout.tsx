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
  // and link previews show, so the two have to agree; it replaced a line that
  // still advertised having no bank connection.
  description:
    "Income, bills, savings and investments — recorded by you or read from your bank, held privately, and reconciled against your real balance at the end of every month.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is rendered on the server rather than applied by a script, so
    // there is no flash of the wrong theme and no blocking script in the
    // head. The class stays — the tokens do not need it, but a few dozen
    // `dark:` utilities across the app resolve against it.
    <html
      lang="en"
      className={`dark ${instrumentSans.variable} ${fraunces.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: privacyInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
