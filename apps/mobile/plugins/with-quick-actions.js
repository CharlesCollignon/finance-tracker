// The home-screen quick actions: a long press on Pluclair's icon offers
// « Ajouter une dépense » and « Le point » (docs/plans/EVERYDAY_PLAN.md,
// phase 1).
//
// Our own plugin rather than expo-quick-actions, which had no release for
// SDK 57 when this was written. Both platforms declare the actions
// statically; each one opens a `pluclair://` address the router already
// knows — `/add` opens the add sheet over Le point.
//
// - Android: `res/xml/shortcuts.xml`, pointed at from the main activity.
//   A shortcut's intent opens the address itself, so nothing else is needed.
// - iOS: `UIApplicationShortcutItems` in Info.plist, each carrying its
//   address in `userInfo.href`. iOS hands a pressed one to the app delegate,
//   which `modules/quick-actions` listens to and passes on to JavaScript.
//
// French labels by default, English for a phone set to English.

const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} = require("expo/config-plugins");

const ACTIONS = [
  {
    id: "add",
    href: "pluclair://add",
    fr: "Ajouter une dépense",
    en: "Add a spend",
    androidIcon: "@mipmap/ic_launcher",
    iosIcon: "UIApplicationShortcutIconTypeAdd",
  },
  {
    id: "bearing",
    href: "pluclair://",
    fr: "Le point",
    en: "Le point",
    androidIcon: "@mipmap/ic_launcher",
    iosIcon: "UIApplicationShortcutIconTypeHome",
  },
];

const escapeXml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "\\'");

function stringsXml(language) {
  const lines = ACTIONS.map(
    (action) =>
      `  <string name="quick_action_${action.id}">${escapeXml(action[language])}</string>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${lines.join("\n")}\n</resources>\n`;
}

function shortcutsXml(packageName) {
  const shortcuts = ACTIONS.map(
    (action) => `  <shortcut
    android:shortcutId="${action.id}"
    android:enabled="true"
    android:icon="${action.androidIcon}"
    android:shortcutShortLabel="@string/quick_action_${action.id}"
    android:shortcutLongLabel="@string/quick_action_${action.id}">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${action.href}"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${shortcuts.join("\n")}\n</shortcuts>\n`;
}

function withAndroidQuickActions(config) {
  config = withDangerousMod(config, [
    "android",
    (modConfig) => {
      const res = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/res",
      );
      const files = {
        "xml/shortcuts.xml": shortcutsXml(modConfig.android.package),
        // Their own file, so nothing else in strings.xml is touched.
        "values/quick_actions.xml": stringsXml("fr"),
        "values-en/quick_actions.xml": stringsXml("en"),
      };
      for (const [file, contents] of Object.entries(files)) {
        const target = path.join(res, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
      }
      return modConfig;
    },
  ]);

  return withAndroidManifest(config, (modConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
      modConfig.modResults,
    );
    const meta = (activity["meta-data"] ?? []).filter(
      (entry) => entry.$["android:name"] !== "android.app.shortcuts",
    );
    meta.push({
      $: {
        "android:name": "android.app.shortcuts",
        "android:resource": "@xml/shortcuts",
      },
    });
    activity["meta-data"] = meta;
    return modConfig;
  });
}

function withIosQuickActions(config) {
  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIApplicationShortcutItems = ACTIONS.map(
      (action) => ({
        UIApplicationShortcutItemType: `pluclair.${action.id}`,
        UIApplicationShortcutItemTitle: action.fr,
        UIApplicationShortcutItemIconType: action.iosIcon,
        UIApplicationShortcutItemUserInfo: { href: action.href },
      }),
    );
    return modConfig;
  });
}

module.exports = function withQuickActions(config) {
  return withIosQuickActions(withAndroidQuickActions(config));
};
