import type { listenerEn } from "./listener.en";

/** `listener.en.ts`, in French. `fr.ts` mounts it as `listener`. */
export const listenerFr: typeof listenerEn = {
  title: "Les notifications de votre banque",
  intro:
    "Avec l'« Accès aux notifications » d'Android, Pluclair lit, sur ce téléphone seulement, les notifications des applications bancaires que vous choisissez — « Paiement de 12,30 € chez MONOP' » — et chacune devient une ligne à vérifier au moment où elle s'affiche. Rien d'autre n'est lu, et rien ne quitte le téléphone que les lignes.",
  invite:
    "Chaque paiement que votre banque annonce, en ligne à vérifier, tout seul.",
  open: "Mettre en place",
  notHere: "Ce téléphone ne peut pas lire les notifications",
  notHereBody:
    "Sur Android seulement, et seulement dans une version de Pluclair qui porte le lecteur.",
  accessTitle: "Accès aux notifications",
  accessOn: "Accordé : Pluclair lit les applications cochées ci-dessous.",
  accessOff: "Pas encore accordé. Android le demande sur sa propre page.",
  openSettings: "Ouvrir les réglages Android",
  appsTitle: "Applications bancaires à lire",
  appsNone:
    "Aucune application bancaire connue n'est installée sur ce téléphone. Pluclair connaît les applications des banques françaises dont il lit les relevés.",
  appsHint: "Seules les applications cochées sont lues.",
  accountTitle: "Leurs lignes vont sur",
  accountNone:
    "Importez d'abord un relevé, pour que Pluclair connaisse le compte où mettre les lignes.",
  readNow: "Lire ce qui attend",
  reading: "Lecture…",
  waiting: {
    one: "{count} notification en attente",
    other: "{count} notifications en attente",
  },
  read: {
    one: "{count} ligne apportée à vérifier",
    other: "{count} lignes apportées à vérifier",
  },
  readNone: "Rien de nouveau à apporter",
  skipped: {
    one: "{count} notification ne disait aucune opération",
    other: "{count} notifications ne disaient aucune opération",
  },
  lastRead: "Dernière lecture {date}",
  broughtSoFar: {
    one: "{count} ligne apportée jusqu'ici",
    other: "{count} lignes apportées jusqu'ici",
  },
  unverified:
    "Mis au point sur les notifications que les banques françaises sont connues pour envoyer, et pas encore vu fonctionner sur un téléphone : vérifiez les premières lignes qu'il apporte.",
};
