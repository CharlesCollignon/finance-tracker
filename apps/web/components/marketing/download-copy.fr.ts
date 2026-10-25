import type { DownloadCopy } from "@/components/marketing/download-copy";

export const downloadCopyFr: DownloadCopy = {
  meta: {
    title: "Télécharger Pluclair pour Android",
    description:
      "L’app Android de Pluclair, gratuite : le fichier, comment l’installer en trois gestes, et ce qui est nouveau.",
  },
  hero: {
    eyebrow: "Bêta ouverte · Android",
    titleLines: ["Pluclair,", "dans votre poche."],
    body: "Le même compte et les mêmes chiffres que sur le site. « Il vous reste » s’affiche sur l’écran d’accueil, avec un + pour noter une dépense.",
    download: "Télécharger l’APK",
    web: "Ou commencer sur le web",
    openApp: "Ouvrir Pluclair sur le web",
    version: "Version {version}",
    free: "Gratuit, sans store",
  },
  qr: {
    heading: "Depuis un ordinateur ?",
    body: "Scannez ce code avec l’appareil photo de votre téléphone Android : le téléchargement commence.",
    label: "QR code du téléchargement",
  },
  stepsHeading: "Installer en trois gestes",
  latest: {
    heading: "Dernières nouveautés sur le téléphone",
    all: "Tout ce qui change",
  },
  faq: {
    heading: "Avant d’installer",
    items: [
      {
        question: "Pourquoi pas le Play Store ?",
        answer:
          "Pluclair est une bêta ouverte, distribuée directement depuis ce site : pas de store entre vous et l’app, et chaque nouvelle version dès qu’elle est prête.",
      },
      {
        question: "Et les mises à jour ?",
        answer:
          "Quand une nouvelle version sort, l’application vous la propose. Elle s’installe par-dessus l’ancienne, et vos données restent : elles sont sur votre compte, pas dans le téléphone.",
      },
      {
        question: "Et sur iPhone ?",
        answer:
          "Pas encore d’app : Pluclair s’utilise dans Safari, avec le même compte.",
      },
    ],
  },
  verify: {
    heading: "Vérifier le fichier",
    body: "Le code de Pluclair est public, et chaque version y est publiée avec son fichier. Son empreinte SHA-256 :",
    releases: "Voir les versions sur GitHub",
  },
};
