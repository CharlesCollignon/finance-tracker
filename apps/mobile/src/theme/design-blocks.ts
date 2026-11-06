import { vars } from "nativewind";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

import { currentDesign } from "@/theme/designs";
import { COLORS } from "@/theme/tokens";

/**
 * The shared blocks' shape in each design (`docs/plans/DESIGN_LAYOUTS_PLAN.md`,
 * phase 8), the phone's twin of the web's tagged blocks in `globals.css`:
 *
 * - « Papier »: a card is a ruled section — no box, an ink rule on top;
 *   corners square; titles and tabs in the serif.
 * - « Bento »: a card is a solid white tile, round, with no border; tabs and
 *   buttons are pills.
 * - « Console »: a card is a square panel with a hairline; titles, tabs and
 *   buttons in the mono face.
 * - « Nuit »: nothing restated (`null`), every block as it is written.
 *
 * Each returns a style to put *before* the caller's own in a style array,
 * so a screen that sets its own spacing or ground still has the last word.
 * Read while rendering: a change of design remounts every screen.
 */

/** A card, and a bezel's inner surface. */
export function cardFrame(): ViewStyle | null {
  switch (currentDesign()) {
    case "papier":
      return {
        backgroundColor: "transparent",
        borderWidth: 0,
        borderTopWidth: 2,
        borderTopColor: COLORS.foreground,
        borderRadius: 0,
      };
    case "bento":
      return {
        backgroundColor: COLORS.card,
        borderWidth: 0,
        borderRadius: 28,
      };
    case "console":
      return {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 2,
      };
    default:
      return null;
  }
}

/** A bezel's outer shell, which flattens to nothing outside « Nuit ». */
export function bezelShell(): ViewStyle | null {
  return currentDesign() === "nuit"
    ? null
    : {
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        borderRadius: 0,
      };
}

/** The header band under the status bar. */
export function headerBar(): ViewStyle | null {
  switch (currentDesign()) {
    case "papier":
      return { borderBottomColor: COLORS.foreground };
    case "bento":
      return { borderBottomWidth: 0 };
    default:
      return null;
  }
}

/** The page's name in that band. */
export function headerTitleFace(): TextStyle | null {
  switch (currentDesign()) {
    case "papier":
      return { fontFamily: "Newsreader-SemiBold" };
    case "bento":
      return { fontFamily: "BricolageGrotesque-Bold" };
    case "console":
      return {
        fontFamily: "IBMPlexMono-Medium",
        textTransform: "uppercase",
        letterSpacing: 1,
      };
    default:
      return null;
  }
}

/** A section's label over a group of rows. */
export function sectionLabelFace(): TextStyle | null {
  return currentDesign() === "console"
    ? { fontFamily: "IBMPlexMono-Medium", letterSpacing: 1.2 }
    : null;
}

/** One of a surface's view tabs (SurfaceTabs). */
export function viewTab(active: boolean): {
  frame: ViewStyle | null;
  label: TextStyle | null;
} {
  switch (currentDesign()) {
    case "papier":
      return {
        frame: {
          backgroundColor: "transparent",
          borderRadius: 0,
          paddingHorizontal: 2,
          marginRight: 14,
          borderBottomWidth: 3,
          borderBottomColor: active ? COLORS.primary : "transparent",
        },
        label: {
          fontFamily: "Newsreader-SemiBold",
          fontSize: 16,
          color: active ? COLORS.foreground : COLORS.mutedForeground,
        },
      };
    case "console":
      return {
        frame: {
          borderRadius: 0,
          borderWidth: 1,
          borderColor: active ? COLORS.primary : COLORS.border,
          backgroundColor: active ? COLORS.primary : "transparent",
        },
        label: {
          fontFamily: "IBMPlexMono-Medium",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: active ? COLORS.primaryForeground : COLORS.mutedForeground,
        },
      };
    default:
      return { frame: null, label: null };
  }
}

/** « Bento »'s grey track behind the view tabs. */
export function viewTabsTrack(): ViewStyle | null {
  switch (currentDesign()) {
    case "bento":
      return {
        alignSelf: "flex-start",
        padding: 4,
        borderRadius: 999,
        backgroundColor: COLORS.muted,
      };
    case "console":
      return { gap: 0 };
    default:
      return null;
  }
}

/** A segmented control: its track, its pill, and its labels. */
export function segmented(): {
  track: ViewStyle | null;
  pill: ViewStyle | null;
  label: TextStyle | null;
} {
  switch (currentDesign()) {
    case "papier":
      return {
        track: { borderRadius: 2 },
        pill: { borderRadius: 1 },
        label: null,
      };
    case "bento":
      return {
        track: { borderColor: "transparent", backgroundColor: COLORS.muted },
        pill: { backgroundColor: COLORS.card },
        label: null,
      };
    case "console":
      return {
        track: { borderRadius: 0 },
        pill: { borderRadius: 0 },
        label: {
          fontFamily: "IBMPlexMono-Medium",
          textTransform: "uppercase",
        },
      };
    default:
      return { track: null, pill: null, label: null };
  }
}

/** A button's corners and face. */
export function buttonFrame(): ViewStyle | null {
  switch (currentDesign()) {
    case "papier":
      return { borderRadius: 2 };
    case "bento":
      return { borderRadius: 999 };
    case "console":
      return { borderRadius: 0 };
    default:
      return null;
  }
}

export function buttonLabelFace(): TextStyle | null {
  return currentDesign() === "console"
    ? { fontFamily: "IBMPlexMono-Medium" }
    : null;
}

/** A sheet's top: square under an ink rule, round, or square and ruled. */
export function sheetFrame(): ViewStyle | null {
  switch (currentDesign()) {
    case "papier":
      return {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderTopWidth: 3,
        borderTopColor: COLORS.foreground,
      };
    case "bento":
      return {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 0,
      };
    case "console":
      return {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderColor: COLORS.hairlineStrong,
      };
    default:
      return null;
  }
}

/** A card's heading (Le point's `HomeCard`): its icon disc and its title. */
export function cardHeading(): {
  showIcon: boolean;
  title: TextStyle | null;
} {
  switch (currentDesign()) {
    case "papier":
      return {
        showIcon: false,
        title: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        },
      };
    case "bento":
      return {
        showIcon: true,
        title: { fontSize: 15, color: COLORS.foreground },
      };
    case "console":
      return {
        showIcon: false,
        title: {
          fontFamily: "IBMPlexMono-Medium",
          fontSize: 11,
          letterSpacing: 1.3,
          textTransform: "uppercase",
        },
      };
    default:
      return { showIcon: true, title: null };
  }
}

/**
 * The space between Le point's cards, and how each is set against the
 * last: « Console » joins them into one ruled column (hairlines shared, not
 * doubled), « Papier » leaves room between its sections.
 */
export function homeStack(): { gap: number; joined: boolean } {
  switch (currentDesign()) {
    case "papier":
      return { gap: 24, joined: false };
    case "bento":
      return { gap: 12, joined: false };
    case "console":
      return { gap: 0, joined: true };
    default:
      return { gap: 16, joined: false };
  }
}

/**
 * « Bento »'s big lime tile (the balance on Le point), with the palette its
 * classes read restated on it — dark ink, an olive for the quiet text, the
 * reds, greens and ambers taken darker so each reads at 5:1 or better on
 * lime — as the web's `.bearing-slot-balance` does. Hairlines are the ink
 * at the classes' own alpha.
 */
const LIME_TILE = vars({
  "--card": "212 242 92",
  "--foreground": "15 17 21",
  "--card-foreground": "15 17 21",
  "--muted": "195 224 74",
  "--muted-foreground": "74 83 32",
  "--secondary": "195 224 74",
  "--primary": "15 17 21",
  "--primary-ink": "15 17 21",
  "--primary-foreground": "212 242 92",
  "--destructive": "166 27 27",
  "--success": "13 90 41",
  "--warning": "122 61 0",
  "--border": "15 17 21",
});

export function accentTile(): StyleProp<ViewStyle> {
  return currentDesign() === "bento"
    ? [LIME_TILE, { backgroundColor: "#d4f25c" }]
    : null;
}
