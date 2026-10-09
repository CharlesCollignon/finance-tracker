import { requestWidgetUpdate } from "react-native-android-widget";

import { currentWidgetFace, rereadWidgetFigure } from "./figure";
import { FIGURE_WIDGET, FigureWidget } from "./FigureWidget";

/**
 * Draw the home-screen widget again, reading the figure anew first when the
 * data under it changed. Nothing happens without a widget on the home
 * screen beyond the read.
 */
export async function updateWidget({
  reread,
}: {
  reread: boolean;
}): Promise<void> {
  if (reread) {
    await rereadWidgetFigure();
  }
  await requestWidgetUpdate({
    widgetName: FIGURE_WIDGET,
    renderWidget: async () => <FigureWidget face={await currentWidgetFace()} />,
  });
}
