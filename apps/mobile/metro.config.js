// Expo's getDefaultConfig auto-detects the pnpm monorepo (watch folders +
// node_modules resolution), so we only layer NativeWind on top of it.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
