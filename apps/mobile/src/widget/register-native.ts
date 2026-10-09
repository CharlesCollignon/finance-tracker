import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./task-handler";

// The home-screen widget's calls, handled with no screen open (see
// `task-handler.tsx`). Loaded by `register.android.ts`, only in a build that
// has the widget.
registerWidgetTaskHandler(widgetTaskHandler);
