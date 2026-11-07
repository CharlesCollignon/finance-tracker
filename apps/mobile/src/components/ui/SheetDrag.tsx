import { createContext, useContext, type ReactNode } from "react";
import { useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { hapticLight } from "@/lib/haptics";

/**
 * A sheet that follows the finger down and closes when let go far or fast
 * enough — the gesture its grabber has always promised.
 *
 * `SheetPanel` is the sheet itself; `SheetDragHandle` is the part you take
 * it by: the grabber and the title row, so the body's own scrolling never
 * fights the drag. Dragged up, the sheet gives a little and comes back;
 * dragged down past the line, a tick says letting go will close it. Below
 * the line it springs home.
 *
 * Closing slides the sheet out and calls `onClose`; the sheet comes back
 * into place a moment later, out of sight once its Modal has faded — or in
 * sight, if the screen chose not to close it.
 */

interface Drag {
  y: SharedValue<number>;
  onClose: () => void;
}

const DragContext = createContext<Drag | null>(null);

/** How far down, at most, before letting go closes the sheet. */
const CLOSE_DISTANCE = 120;
/** A flick this fast downwards closes it from any distance (pt/s). */
const CLOSE_VELOCITY = 900;

export function SheetPanel({
  onClose,
  style,
  className,
  children,
}: {
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children: ReactNode;
}) {
  const y = useSharedValue(0);
  const moved = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }));
  return (
    <DragContext.Provider value={{ y, onClose }}>
      <Animated.View style={[style, moved]} className={className}>
        {children}
      </Animated.View>
    </DragContext.Provider>
  );
}

export function SheetDragHandle({ children }: { children: ReactNode }) {
  const drag = useContext(DragContext);
  const { height } = useWindowDimensions();
  const past = useSharedValue(false);
  if (!drag) {
    return <>{children}</>;
  }
  const { y, onClose } = drag;
  const line = Math.min(CLOSE_DISTANCE, height * 0.18);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    // A little above and below the handle counts too: it is a thin target.
    .hitSlop({ top: 12, bottom: 8 })
    .onStart(() => {
      past.set(false);
    })
    .onUpdate((event) => {
      const dy = event.translationY;
      // Upwards it gives a little, then holds.
      y.set(dy >= 0 ? dy : -Math.min(24, Math.sqrt(-dy) * 2.4));
      const beyond = dy > line;
      if (beyond !== past.get()) {
        past.set(beyond);
        if (beyond) {
          scheduleOnRN(hapticLight);
        }
      }
    })
    .onEnd((event) => {
      const close =
        event.translationY > line ||
        (event.velocityY > CLOSE_VELOCITY && event.translationY > 0);
      if (!close) {
        y.set(withSpring(0, { damping: 22, stiffness: 260, mass: 0.9 }));
        return;
      }
      const remaining = Math.max(height - event.translationY, 0);
      const duration = Math.min(
        260,
        Math.max(140, (remaining / Math.max(event.velocityY, 1200)) * 1000),
      );
      y.set(
        withTiming(
          height,
          { duration, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) {
              scheduleOnRN(onClose);
              // Home again once the Modal has faded out — or, if the
              // screen kept the sheet open, back up into view.
              y.set(withDelay(360, withSpring(0, { damping: 22, stiffness: 260 })));
            }
          },
        ),
      );
    });

  // Android needs a gesture root inside each Modal's own window.
  return (
    <GestureHandlerRootView style={{ alignSelf: "stretch" }}>
      <GestureDetector gesture={pan}>
        <Animated.View collapsable={false}>{children}</Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
