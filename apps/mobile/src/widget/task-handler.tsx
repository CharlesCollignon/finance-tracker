import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { currentWidgetFace, rereadWidgetFigure } from "./figure";
import { FigureWidget } from "./FigureWidget";

/**
 * Android's calls to the widget, with no screen of the app open: when it is
 * put on the home screen and every half hour after (`updatePeriodMillis` in
 * `app.json`), the figure is read anew first — the bank's sync or the web
 * may have moved it; on a resize it is only drawn again. Its taps open
 * `pluclair://` addresses themselves and never reach here.
 */
export async function widgetTaskHandler({
  widgetAction,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
      await rereadWidgetFigure();
      renderWidget(<FigureWidget face={await currentWidgetFace()} />);
      return;
    case "WIDGET_RESIZED":
      renderWidget(<FigureWidget face={await currentWidgetFace()} />);
      return;
    default:
      return;
  }
}
