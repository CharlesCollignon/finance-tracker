import type { DownloadCopy } from "@/components/marketing/download-copy";

export const downloadCopyFr: DownloadCopy = {
  meta: {
    title: "Télécharger Pluclair pour Android et iPhone",
    description:
      "Pluclair sur votre téléphone, gratuit : l’app Android à télécharger, l’iPhone depuis Safari, comment les installer, et ce qui est nouveau.",
  },
  hero: {
    eyebrow: "Bêta ouverte · Android et iPhone",
    titleLines: ["Pluclair,", "dans votre poche."],
    body: "Le même compte et les mêmes chiffres que sur le site. « Il vous reste » s’affiche sur l’écran d’accueil, avec un + pour noter une dépense.",
    download: "Télécharger l’APK",
    web: "Ou commencer sur le web",
    openApp: "Ouvrir Pluclair sur le web",
    version: "Version {version}",
    free: "Gratuit, sans store",
    iphoneLink: "Sur iPhone ?",
    iphone: {
      body: "Le même compte et les mêmes chiffres que sur le site, en plein écran depuis l’écran d’accueil de votre iPhone.",
      homeScreen: {
        cta: "Installer sur iPhone",
        facts: "Gratuit, depuis Safari, en trois gestes",
      },
      testFlight: {
        cta: "Rejoindre la bêta iPhone",
        facts: "Gratuit, avec TestFlight, l’app d’Apple pour les bêtas",
      },
      appStore: { cta: "Télécharger dans l’App Store", facts: "Gratuit" },
    },
  },
  qr: {
    heading: "Depuis un ordinateur ?",
    body: "Scannez ce code avec l’appareil photo de votre téléphone Android : le téléchargement commence.",
    label: "QR code du téléchargement",
  },
  stepsHeading: "Sur Android, en trois gestes",
  iphone: {
    heading: "Sur iPhone",
    homeScreenOnly:
      "Pas encore d’app iPhone. En attendant, Pluclair se met sur l’écran d’accueil depuis Safari : il s’ouvre ensuite en plein écran, comme une app, avec votre compte — et ses rappels peuvent arriver en notifications.",
    orHomeScreen:
      "Ou sans rien installer : Pluclair se met aussi sur l’écran d’accueil depuis Safari, et s’ouvre en plein écran, comme une app.",
    testFlight: {
      heading: "La bêta iPhone",
      body: "L’app iPhone, avant l’App Store. Installez TestFlight, l’app d’Apple pour les bêtas, puis rejoignez celle de Pluclair : le bouton ouvre l’invitation.",
      join: "Rejoindre la bêta",
    },
    appStore: {
      heading: "Dans l’App Store",
      body: "L’app iPhone de Pluclair, gratuite.",
      download: "Télécharger dans l’App Store",
    },
    steps: [
      "Sur votre iPhone, ouvrez Pluclair dans Safari et connectez-vous — ou créez votre compte.",
      "Touchez Partager — le carré d’où sort une flèche, parfois sous « ⋯ » — puis « Sur l’écran d’accueil ».",
      "Touchez « Ajouter ». Pluclair s’ouvre maintenant depuis son icône ; pour les rappels, activez les notifications dans Profil.",
    ],
    open: "Ouvrir Pluclair",
    qr: {
      heading: "Depuis un ordinateur ?",
      body: "Scannez ce code avec l’appareil photo de l’iPhone : Pluclair s’ouvre dans Safari.",
      label: "QR code pour ouvrir Pluclair sur iPhone",
    },
    screen: {
      label:
        "Un écran d’accueil d’iPhone : le menu Partager propose « Sur l’écran d’accueil », et l’icône de Pluclair vient s’y poser.",
      addToHomeScreen: "Sur l’écran d’accueil",
      appName: "Pluclair",
      replay: "Revoir",
    },
  },
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
