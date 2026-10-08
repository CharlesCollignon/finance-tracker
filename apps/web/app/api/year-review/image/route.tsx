import { ImageResponse } from "next/og";
import { todayIsoLocal } from "@finance/core/constants";
import { DEFAULT_LOCALE, parseLocale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { yearReviewCards } from "@finance/core/year-review";
import { readYearReview } from "@finance/data/year-review";
import { getAuthUser } from "@/lib/auth/get-user";
import { sessionFromBearer } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

/**
 * « Votre année » as an image to share: the review's cards with no amount in
 * them (`yearReviewCards` without a money formatter) — percentages and
 * counts — on Pluclair's dark ground. Drawn for the account asking, from the
 * browser's session or the phone's bearer token, and kept nowhere.
 *
 * `?y=` the year, `?l=` the language.
 */

/** What the image is drawn on, and in: the app's own colours. */
const GROUND = "#0a0a10";
const GOLD = "#ecb25e";
const INK = "#f5f3ef";
const MUTED = "#9a98a6";

/**
 * French puts a narrow no-break space before « % », which the image's font
 * has no glyph for; an ordinary no-break space holds the same place.
 */
function drawable(text: string): string {
  return text.replace(/ /g, " ");
}

export async function GET(request: Request) {
  const bearer = await sessionFromBearer(request);
  const user = bearer ? null : await getAuthUser();
  if (!bearer && !user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = bearer?.userId ?? user!.id;
  const db = bearer?.supabase ?? (await createClient());

  const url = new URL(request.url);
  const today = todayIsoLocal();
  const current = Number(today.slice(0, 4));
  const asked = Number(url.searchParams.get("y"));
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked < current
      ? asked
      : current - 1;
  const locale = parseLocale(url.searchParams.get("l")) ?? DEFAULT_LOCALE;
  const t = translator(locale);

  const review = await readYearReview(db, userId, year, { today, locale });
  if (!review) {
    return new Response("Not found", { status: 404 });
  }
  const cards = yearReviewCards(review, { t, locale, formatMoney: null });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 96,
        background: GROUND,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
        {drawable(t("yearReview.imageTitle", { year }))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div style={{ display: "flex", fontSize: 96, color: GOLD }}>
              {drawable(card.figure)}
            </div>
            <div style={{ display: "flex", fontSize: 40, color: INK }}>
              {drawable(card.caption)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: MUTED }}>
        Pluclair · pluclair.com
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
