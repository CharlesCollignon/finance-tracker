import { View } from "react-native";

/**
 * The bar at the top of a sheet that says it can be dragged down.
 *
 * Seven sheets drew their own. The bar itself matched everywhere, but the
 * spacing and centring around it did not, so the same affordance sat a few
 * pixels differently depending on which sheet you had opened. One component
 * so it cannot drift again.
 *
 * Hidden from assistive tech: it is a hint about a gesture, and every sheet
 * that has one also has a labelled close control.
 */
export function SheetGrabber() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mb-3 h-1 w-10 self-center rounded-full bg-hairline-strong"
    />
  );
}
