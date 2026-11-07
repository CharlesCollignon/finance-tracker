import { View } from "react-native";

import { SheetDragHandle } from "@/components/ui/SheetDrag";

/**
 * The bar at the top of a sheet that says it can be dragged down — and,
 * inside a `SheetPanel`, the handle that drags it (`SheetDrag.tsx`): the
 * full width of the sheet at its height, so the thumb need not find the bar.
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
    <SheetDragHandle>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="items-center pb-3"
      >
        <View className="h-1 w-10 rounded-full bg-hairline-strong" />
      </View>
    </SheetDragHandle>
  );
}
