import { ImageResponse } from "next/og";
import { getCurrentMonth, parseMonthParams } from "@finance/core/constants";
import { DEFAULT_LOCALE, parseLocale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { getAuthUser } from "@/lib/auth/get-user";
import { readMonthShare } from "@/lib/bearing/share";
import { getOwner } from "@/lib/owner";
import { sessionFromBearer } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

/**
 * « Relevé du mois » as an image to share: the month's lines
 * (`@finance/core/month-share`) on Pluclair's dark ground — with the
 * amounts when `?amounts=1`, with the shares and a sign otherwise. Drawn
 * for the account asking, from the browser's session or the phone's bearer
 * token, for the owner on screen (`?owner=` for the phone, a space the
 * person is in), and kept nowhere.
 *
 * `?y=` and `?m=` the month, `?l=` the language.
 */

const GROUND = "#0a0a10";
const GOLD = "#fa9842";
const INK = "#f5f3ef";
const MUTED = "#9a98a6";
const BAR = "#2a2a3a";

/** A narrow no-break space has no glyph in the image's font. */
function drawable(text: string): string {
  return text.replace(/ /g, " ");
}

export async function GET(request: Request) {
  const bearer = await sessionFromBearer(request);
  const user = bearer ? null : await getAuthUser();
  if (!bearer && !user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const userId = bearer?.userId ?? user!.id;
  const db = bearer?.supabase ?? (await createClient());
  // Whose month: the web's owner on screen; the phone names a space it is
  // in, and the rows' own policies refuse any other.
  const asked = url.searchParams.get("owner");
  const ownerId = bearer
    ? asked && /^[0-9a-f-]{36}$/i.test(asked)
      ? asked
      : userId
    : ((await getOwner())?.ownerId ?? userId);

  const { year, month } =
    url.searchParams.get("y") && url.searchParams.get("m")
      ? parseMonthParams(
          url.searchParams.get("y") ?? undefined,
          url.searchParams.get("m") ?? undefined,
        )
      : getCurrentMonth();
  const locale = parseLocale(url.searchParams.get("l")) ?? DEFAULT_LOCALE;
  const withAmounts = url.searchParams.get("amounts") === "1";
  const t = translator(locale);

  const share = await readMonthShare(db, ownerId, year, month, locale, withAmounts);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 88,
        background: GROUND,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
        {drawable(share.title)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {share.lines.map((line) => (
          <div
            key={line.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", fontSize: 40, color: MUTED }}>
              {drawable(line.label)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: line.id === "net" || line.id === "kept" ? 72 : 52,
                color: line.id === "net" || line.id === "kept" ? GOLD : INK,
              }}
            >
              {drawable(line.figure)}
            </div>
          </div>
        ))}
      </div>

      {share.categories.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 34, color: MUTED }}>
            {drawable(t("monthShare.whereItWent"))}
          </div>
          {share.categories.map((category) => (
            <div
              key={category.name}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 36,
                }}
              >
                <div style={{ display: "flex" }}>{drawable(category.name)}</div>
                <div style={{ display: "flex", color: MUTED }}>
                  {drawable(category.figure)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 14,
                  width: "100%",
                  background: BAR,
                  borderRadius: 7,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    height: 14,
                    width: `${Math.max(2, Math.round(category.ratio * 100))}%`,
                    background: GOLD,
                    borderRadius: 7,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
        {t("monthShare.madeWith")}
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
