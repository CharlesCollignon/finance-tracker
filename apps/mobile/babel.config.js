module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Must be last. Reanimated 4 worklets crash the release APK without this.
    plugins: ["react-native-worklets/plugin"],
  };
};
