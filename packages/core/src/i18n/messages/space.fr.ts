import type { spaceEn } from "./space.en";

/** The French half of `space.en.ts`, mounted by `fr.ts` as `space`. */
export const spaceFr: typeof spaceEn = {
  mine: "Moi",
  switchLabel: "Quel argent afficher",
  section: "Espace commun",
  footer:
    "Votre argent à vous reste à vous : votre partenaire ne voit que l'espace commun.",

  emptyTitle: "L'argent à deux",
  emptyBody:
    "Un espace pour ce que vous dépensez ensemble — courses, loyer, compte joint. Chacun garde le sien.",
  create: "Créer l'espace commun",
  waitingBody:
    "Invitez votre partenaire avec un lien : valable sept jours, pour une seule personne.",
  invite: "Créer un lien d'invitation",
  inviteCopy: "Copier",
  inviteCopied: "Copié",
  inviteSend: "Envoyer…",
  inviteShareText: "Rejoignez mon espace commun sur Pluclair",
  togetherBody:
    "Vous et {name} partagez cet espace. Chacun garde son argent à lui.",
  name: "Nom",

  leave: "Quitter l'espace",
  leaveBody:
    "Vous perdez l'accès tout de suite ; {name} garde l'espace et ses opérations.",
  leaveLastBody:
    "Personne d'autre n'y est : l'espace et ses opérations seront supprimés.",
  export: "Télécharger ses opérations (CSV)",
  leaveConfirm: "Quitter",

  created: "Espace commun créé",
  joined: "Bienvenue dans l'espace commun",
  left: "Vous avez quitté l'espace commun",
  alreadyInOne: "Vous êtes déjà dans un espace commun.",
  full: "Cet espace est déjà à deux.",
  inviteUnusable: "Ce lien ne fonctionne plus.",
  nameInvalid: "Entre 1 et 40 caractères.",

  joinTitle: "{name} vous invite dans « {space} »",
  joinBody:
    "Ce que vous dépensez ensemble, au même endroit. Ce qui est à vous reste à vous : {name} ne verra que l'espace commun.",
  join: "Rejoindre",
  joinSignedOutTitle: "Un espace commun à deux",
  joinSignedOutBody:
    "On vous invite à partager un espace sur Pluclair. Connectez-vous ou créez votre compte : le lien vous attendra.",
  joinUnusableBody:
    "Un lien sert une fois, pendant sept jours. Demandez-en un nouveau.",
  joinAlreadyHere: "Vous êtes déjà dans cet espace.",
  joinOpen: "L'ouvrir",
  joinElsewhereBody:
    "Quittez-le d'abord depuis votre profil : un espace commun par personne.",
  transferCategory: "Versement au compte commun",
  addedBy: "Ajouté par {name}",
};
