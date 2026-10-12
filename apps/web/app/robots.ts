import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * What a crawler may read: the marketing site. Everything behind the login
 * only ever answers a crawler with the login page, so it is left out rather
 * than crawled for nothing; the API and the auth callbacks too.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/auth/",
  "/ask",
  "/bank",
  "/bearing",
  "/calendar",
  "/categories",
  "/history",
  "/import",
  "/investments",
  "/join",
  "/plan",
  "/profile",
  "/property",
  "/recurring",
  "/reset",
  "/transactions",
  "/welcome",
  "/year",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
