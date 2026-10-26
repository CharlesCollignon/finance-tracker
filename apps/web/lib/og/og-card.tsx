import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The card a shared link to the site shows: the marketing room's ground, a
 * small kicker, the page's title in the site's own type, a line under it,
 * and the orb rising out of the bottom-right corner in its own light — the
 * hero's sunrise, at the size of a link preview.
 *
 * Drawn in French whatever the sharer reads in: the crawlers that fetch it
 * carry no language cookie, and the site's first language is French.
 *
 * `next/og` cannot read woff2, so the two weights are static TTFs instanced
 * from `app/fonts/instrument-sans-latin.woff2` (fontTools `varLib.instancer`
 * at wght 400 and 500); the same face as the pages, not a lookalike.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** The marketing shell's own colours (`.marketing-shell` in globals.css). */
const GROUND = "#06060a";
const INK = "#f6f3ed";
const MUTED = "rgba(255, 255, 255, 0.55)";
const GOLD = "#fa9842";

/** A line under the title longer than this is cut at a word, with « … ». */
const SUBTITLE_MAX = 150;

/**
 * French puts a narrow no-break space before « : », « ? » and « % », which
 * the latin subset has no glyph for; an ordinary no-break space holds the
 * same place (as in the year review's image).
 */
function drawable(text: string): string {
  return text.replace(/ /g, " ");
}

function shortened(text: string): string {
  if (text.length <= SUBTITLE_MAX) {
    return text;
  }
  const cut = text.slice(0, SUBTITLE_MAX);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}

export async function ogCard({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}): Promise<ImageResponse> {
  const [regular, medium, orb] = await Promise.all([
    readFile(join(process.cwd(), "app", "fonts", "instrument-sans-400.ttf")),
    readFile(join(process.cwd(), "app", "fonts", "instrument-sans-500.ttf")),
    readFile(join(process.cwd(), "public", "icon-512.png")),
  ]);
  const orbSrc = `data:image/png;base64,${orb.toString("base64")}`;
  const titleSize = title.length > 34 ? 76 : 92;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: GROUND,
        color: INK,
        fontFamily: "Instrument Sans",
        overflow: "hidden",
      }}
    >
      {/* The orb, rising out of the corner in its own light. The light is
          cast by a disc the size of the drawn sphere, which sits inside the
          icon's transparent margin (about 4% on each side). */}
      <div
        style={{
          position: "absolute",
          right: -110,
          bottom: -190,
          width: 520,
          height: 520,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            width: 476,
            height: 476,
            display: "flex",
            borderRadius: 9999,
            boxShadow:
              "0 0 140px 40px rgba(251, 123, 24, 0.30), 0 0 320px 120px rgba(251, 123, 24, 0.10)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not a page */}
        <img src={orbSrc} alt="" width={520} height={520} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not a page */}
          <img src={orbSrc} alt="" width={40} height={40} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 500 }}>
            Pluclair
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 780,
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: GOLD,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {drawable(kicker)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: -titleSize * 0.035,
            }}
          >
            {drawable(title)}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                lineHeight: 1.35,
                color: MUTED,
                maxWidth: 700,
              }}
            >
              {drawable(shortened(subtitle))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
          pluclair.com
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Instrument Sans",
          data: regular,
          weight: 400,
          style: "normal",
        },
        { name: "Instrument Sans", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
