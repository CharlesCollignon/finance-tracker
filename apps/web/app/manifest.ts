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
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --background in globals.css so the splash does not flash white
    // on a device in dark mode.
    background_color: "#f1ece5",
    theme_color: "#f1ece5",
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
      {
        src: "/icon-512.png",
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
