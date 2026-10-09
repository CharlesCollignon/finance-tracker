import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./task-handler";

// The home-screen widget's calls, handled with no screen open (see
// `task-handler.tsx`). Android only: the file's suffix keeps it out of the
// iOS and web bundles, and `register.ts` stands in for them.
registerWidgetTaskHandler(widgetTaskHandler);
