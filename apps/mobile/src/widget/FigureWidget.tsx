import type { WidgetFace } from "@finance/core/widget-figure";
import {
  FlexWidget,
  TextWidget,
  type ColorProp,
} from "react-native-android-widget";

import { COLORS } from "@/theme/tokens";

/** The widget's name, as `app.json` declares it to Android. */
export const FIGURE_WIDGET = "Figure";

/** The addresses the router already knows: Le point, and its add sheet. */
const BEARING_URI = "pluclair://";
const ADD_URI = "pluclair://add";

const ink = (color: string) => color as ColorProp;

/**
 * `COLORS.border` (the foreground at 10 %) laid over the card, as one
 * opaque colour: a home screen's wallpaper is not the app's ground.
 */
const RIM = "#292935";

/**
 * The « + »: the add sheet over Le point, the widget's one action. The same
 * gold disc as the add button in the tab bar.
 */
function AddButton({ label }: { label: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: ADD_URI }}
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: ink(COLORS.primary),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TextWidget
        text="+"
        style={{
          fontSize: 26,
          fontWeight: "600",
          color: ink(COLORS.primaryForeground),
        }}
      />
    </FlexWidget>
  );
}

/**
 * The Android home-screen widget (`EVERYDAY_PLAN.md`, phase 3): « Il vous
 * reste » as Le point says it, the whole widget opening Le point and the
 * « + » the add sheet. With no figure to show — the privacy blur, nothing
 * read today, nobody signed in — the two ways in alone.
 */
export function FigureWidget({ face }: { face: WidgetFace }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: BEARING_URI }}
      accessibilityLabel={face.bearing}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 24,
        backgroundColor: ink(COLORS.card),
        borderWidth: 1,
        borderColor: ink(RIM),
      }}
    >
      {face.kind === "figure" ? (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent" }}>
          <TextWidget
            text={face.title}
            maxLines={1}
            style={{ fontSize: 13, color: ink(COLORS.mutedForeground) }}
          />
          <TextWidget
            text={face.amount}
            maxLines={1}
            style={{
              fontSize: 30,
              fontWeight: "700",
              color: ink(COLORS.foreground),
            }}
          />
          <TextWidget
            text={
              face.perDay === null ? face.until : `${face.until} · ${face.perDay}`
            }
            maxLines={2}
            truncate="END"
            style={{ fontSize: 12, color: ink(COLORS.mutedForeground) }}
          />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Pluclair"
          maxLines={1}
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: ink(COLORS.primary),
          }}
        />
      )}
      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextWidget
          text={face.bearing}
          maxLines={1}
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: ink(COLORS.foreground),
          }}
        />
        <AddButton label={face.add} />
      </FlexWidget>
    </FlexWidget>
  );
}
