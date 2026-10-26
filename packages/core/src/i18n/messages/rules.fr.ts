import type { rulesEn } from "./rules.en";

/** The French half of `rules.en.ts`, mounted by `fr.ts` as `rules`. */
export const rulesFr: typeof rulesEn = {
  title: "Règles de rangement",
  intro:
    "Une ligne qui contient ces mots est rangée là, à chaque fois — avant tout ce que l'application a appris seule.",
  empty: "Pas encore de règle",
  emptyBody:
    "Écrivez-en une depuis « À vérifier » avec « Toujours ranger ici », ou ici, avec les mots à trouver et la catégorie où ils vont.",
  words: "Mots à trouver",
  wordsPlaceholder: "ex. NAVIGO",
  wordsTooShort: "Deux caractères au moins",
  wordsTooLong: "Quatre-vingts caractères au plus",
  category: "Catégorie",
  direction: "Argent",
  directionOut: "Qui sort",
  directionIn: "Qui rentre",
  add: "Ajouter la règle",
  adding: "Ajout…",
  added: "Règle ajoutée",
  delete: "Supprimer",
  deleteNamed: "Supprimer la règle « {words} »",
  deleted: "Règle supprimée",
  edit: "Modifier",
  editNamed: "Modifier la règle « {words} »",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "Règle enregistrée",
  alreadyExists: "Une règle avec ces mots existe déjà",
  applied: { one: "{count} ligne rangée", other: "{count} lignes rangées" },
  appliedNone: "Aucune ligne rangée pour l'instant",
  from: "D'après « {line} »",
  always: "Toujours ranger ici",
  alwaysHint: "Écrit une règle avec ces mots : « {words} »",
  ruleWritten: "Règle écrite : « {words} » → {category}",
  link: "Règles de rangement",
  linkHint: "Les mots que vous avez décidés, et où ils vont",
};
