import type { Locale } from "@finance/core/i18n/locale";
import { downloadCopyFr } from "@/components/marketing/download-copy.fr";

/** The download page (`DownloadPage.tsx`), in French first. */
export const DOWNLOAD_HREF = "/telecharger";

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
  };
  qr: { heading: string; body: string; label: string };
  stepsHeading: string;
  latest: { heading: string; all: string };
  faq: { heading: string; items: { question: string; answer: string }[] };
  verify: { heading: string; body: string; releases: string };
}

const downloadCopy: DownloadCopy = {
  meta: {
    title: "Download Pluclair for Android",
    description:
      "Pluclair’s Android app, free: the file, how to install it in three steps, and what is new.",
  },
  hero: {
    eyebrow: "Open beta · Android",
    titleLines: ["Pluclair,", "in your pocket."],
    body: "The same account and the same figures as on the site. “You have” sits on your home screen, with a + to note a spend.",
    download: "Download the APK",
    web: "Or start on the web",
    openApp: "Open Pluclair on the web",
    version: "Version {version}",
    free: "Free, no store",
  },
  qr: {
    heading: "On a computer?",
    body: "Scan this code with your Android phone’s camera: the download starts.",
    label: "QR code for the download",
  },
  stepsHeading: "Install in three steps",
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
      {
        question: "And on iPhone?",
        answer: "No app yet: Pluclair works in Safari, with the same account.",
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
