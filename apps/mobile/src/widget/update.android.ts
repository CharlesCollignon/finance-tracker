import { hasWidget } from "./native";

/**
 * Draw the home-screen widget again (`draw.tsx`), reading the figure anew
 * first when asked. Nothing in a build without the widget, such as Expo Go:
 * `draw.tsx` is required only then, so the library is never loaded there.
 */
export async function updateWidget(options: {
  reread: boolean;
}): Promise<void> {
  if (!hasWidget) {
    return;
  }
  const { drawWidget } = await import("./draw");
  await drawWidget(options);
}
