import { serializeJsonLd } from "@/lib/seo/structured-data";

/** A page's schema.org description, for crawlers (`lib/seo/structured-data`). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
