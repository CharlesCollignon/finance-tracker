import { Stack } from "expo-router";

import { OwnBackdrops } from "@/components/AppBackdrop";
import { COLORS } from "@/theme/tokens";
import { DURATION } from "@finance/core/motion";

/**
 * Immobilier, as a stack inside its tab: the list, then a property's own
 * screen pushed over it with the tab bar still there — it used to open over
 * the whole app, and the bar disappeared with it. A press on the tab while a
 * property is open goes back to the list.
 */
/** The list under a property opened straight from elsewhere, to go back to. */
export const unstable_settings = { initialRouteName: "index" };

export default function PropertyLayout() {
  // Each screen on its own ground, as before the tabs shared one: a
  // property fades in over the list, which must not show through it.
  return (
    <OwnBackdrops>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          // A screen arrives as everything does: a fade (its length is
          // Android's own; iOS takes ours).
          animation: "fade",
          animationDuration: DURATION.enter,
        }}
      />
    </OwnBackdrops>
  );
}
