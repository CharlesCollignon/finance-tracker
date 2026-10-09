import { hasWidget } from "./native";

// The home-screen widget's handler, in a build that has the widget. Android
// only: the suffix keeps it out of the iOS and web bundles, and `register.ts`
// stands in for them. Required rather than imported, so Expo Go never loads
// the library (`native.ts`).
if (hasWidget) {
  // A require, not an import: an import is hoisted and always runs; and not
  // `import()`, which would register after Android may already have called.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./register-native");
}
