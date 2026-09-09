import type { MetadataRoute } from "next";

/**
 * Makes the web app installable.
 *
 * The icons have shipped in `public/` since the beginning but nothing pointed
 * at them, so the app could not go on a home screen. For a manual-entry ledger
 * that matters more than it would elsewhere: the moment you want to log a
 * purchase is while standing at the till, and opening a browser tab to do it
 * is most of the reason it does not get logged.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pluclair",
    short_name: "Pluclair",
    description:
      "Your money, month by month — what came in, what went out, what is set aside and what is invested.",
    start_url: "/bearing",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --background in globals.css so the splash does not flash a
    // ground the app never opens on. Both stood at #f7f5f2, which was right
    // while a paper light palette shipped alongside the dark one; that
    // palette is gone and --background is this near-black, so the pair had
    // been left behind and the splash flashed light into a dark app.
    background_color: "#0a0a10",
    theme_color: "#0a0a10",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Its own file, not the 512 above doing both jobs. A maskable icon is
      // cropped to whatever shape the platform prefers, so it has to hold the
      // orb well inside its edges — and an "any" icon padded that far in just
      // looks small everywhere it is not cropped.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Add transaction",
        short_name: "Add",
        description: "Log something you just spent",
        url: "/transactions?add=1",
      },
    ],
  };
}
