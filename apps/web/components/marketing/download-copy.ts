import type { Locale } from "@finance/core/i18n/locale";
import { downloadCopyFr } from "@/components/marketing/download-copy.fr";

/** The download page (`DownloadPage.tsx`), in French first. */
export const DOWNLOAD_HREF = "/telecharger";

/** Its iPhone section, for a link from elsewhere on the site. */
export const IPHONE_SECTION_ID = "iphone";
export const IPHONE_HREF = `${DOWNLOAD_HREF}#${IPHONE_SECTION_ID}`;

export interface DownloadCopy {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    titleLines: string[];
    body: string;
    download: string;
    web: string;
    openApp: string;
    /** `{version}`: the APK's, from its release. */
    version: string;
    free: string;
    /** After the file's facts, off an iPhone: to the iPhone section. */
    iphoneLink: string;
    /**
     * On an iPhone, in place of the APK's words: the button and the line
     * under it, for each way the iPhone has Pluclair (`iosApp`).
     */
    iphone: {
      body: string;
      homeScreen: { cta: string; facts: string };
      testFlight: { cta: string; facts: string };
      appStore: { cta: string; facts: string };
    };
  };
  qr: { heading: string; body: string; label: string };
  stepsHeading: string;
  iphone: {
    heading: string;
    /** While there is no iPhone app to install. */
    homeScreenOnly: string;
    /** Once there is, above the home screen's steps. */
    orHomeScreen: string;
    testFlight: { heading: string; body: string; join: string };
    appStore: { heading: string; body: string; download: string };
    steps: string[];
    /** On the iPhone itself, under the first step. */
    open: string;
    qr: { heading: string; body: string; label: string };
    screen: {
      label: string;
      addToHomeScreen: string;
      appName: string;
      replay: string;
    };
  };
  latest: { heading: string; all: string };
  faq: { heading: string; items: { question: string; answer: string }[] };
  verify: { heading: string; body: string; releases: string };
}

const downloadCopy: DownloadCopy = {
  meta: {
    title: "Download Pluclair for Android and iPhone",
    description:
      "Pluclair on your phone, free: the Android app to download, the iPhone from Safari, how to install them, and what is new.",
  },
  hero: {
    eyebrow: "Open beta · Android and iPhone",
    titleLines: ["Pluclair,", "in your pocket."],
    body: "The same account and the same figures as on the site. “You have” sits on your home screen, with a + to note a spend.",
    download: "Download the APK",
    web: "Or start on the web",
    openApp: "Open Pluclair on the web",
    version: "Version {version}",
    free: "Free, no store",
    iphoneLink: "On iPhone?",
    iphone: {
      body: "The same account and the same figures as on the site, full screen from your iPhone’s home screen.",
      homeScreen: {
        cta: "Install on iPhone",
        facts: "Free, from Safari, in three steps",
      },
      testFlight: {
        cta: "Join the iPhone beta",
        facts: "Free, through TestFlight, Apple’s app for betas",
      },
      appStore: { cta: "Download on the App Store", facts: "Free" },
    },
  },
  qr: {
    heading: "On a computer?",
    body: "Scan this code with your Android phone’s camera: the download starts.",
    label: "QR code for the download",
  },
  stepsHeading: "On Android, in three steps",
  iphone: {
    heading: "On iPhone",
    homeScreenOnly:
      "No iPhone app yet. Meanwhile, Pluclair goes on your home screen from Safari: it then opens full screen, like an app, with your account — and its reminders can arrive as notifications.",
    orHomeScreen:
      "Or install nothing: Pluclair also goes on your home screen from Safari, and opens full screen, like an app.",
    testFlight: {
      heading: "The iPhone beta",
      body: "The iPhone app, before the App Store. Install TestFlight, Apple’s app for betas, then join Pluclair’s: the button opens the invitation.",
      join: "Join the beta",
    },
    appStore: {
      heading: "On the App Store",
      body: "Pluclair’s iPhone app, free.",
      download: "Download on the App Store",
    },
    steps: [
      "On your iPhone, open Pluclair in Safari and sign in — or create your account.",
      "Tap Share — the square with an arrow, sometimes under “⋯” — then “Add to Home Screen”.",
      "Tap “Add”. Pluclair now opens from its icon; for reminders, turn notifications on in Profile.",
    ],
    open: "Open Pluclair",
    qr: {
      heading: "On a computer?",
      body: "Scan this code with your iPhone’s camera: Pluclair opens in Safari.",
      label: "QR code to open Pluclair on iPhone",
    },
    screen: {
      label:
        "An iPhone home screen: the Share menu offers “Add to Home Screen”, and Pluclair’s icon settles there.",
      addToHomeScreen: "Add to Home Screen",
      appName: "Pluclair",
      replay: "Play again",
    },
  },
  latest: {
    heading: "Latest on the phone",
    all: "Everything that changes",
  },
  faq: {
    heading: "Before you install",
    items: [
      {
        question: "Why not the Play Store?",
        answer:
          "Pluclair is an open beta, handed out straight from this site: no store between you and the app, and each new version as soon as it is ready.",
      },
      {
        question: "What about updates?",
        answer:
          "When a new version is out, the app offers it. It installs over the old one, and your data stays: it is on your account, not on the phone.",
      },
    ],
  },
  verify: {
    heading: "Check the file",
    body: "Pluclair’s code is public, and every version is published there with its file. Its SHA-256 fingerprint:",
    releases: "See the versions on GitHub",
  },
};

export function downloadCopyFor(locale: Locale): DownloadCopy {
  return locale === "en" ? downloadCopy : downloadCopyFr;
}
