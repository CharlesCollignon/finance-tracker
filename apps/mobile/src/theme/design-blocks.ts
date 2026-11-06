import type { TextStyle, ViewStyle } from "react-native";

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
