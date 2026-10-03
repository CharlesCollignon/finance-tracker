import type { actionsEn } from "./actions.en";

/** The French half of `actions.en.ts`, mounted by `fr.ts` as `actions`. */
export const actionsFr: typeof actionsEn = {
  invalidDateRange: "Période invalide",
  invalidStartingBalance: "Saisissez un solde de départ valide",
  shareCountPositive: "Le nombre de parts doit être positif",
  unsupportedLanguage: "Langue non prise en charge",

  transactionNotFound: "Cette opération n'existe plus",
  recurringNotFound: "Cette opération récurrente n'existe plus",
  categoryMissing: "Cette catégorie n'existe plus.",
  oneCategoryMissing: "L'une des catégories n'existe plus.",
  categoryInUse:
    "Des opérations, ponctuelles ou récurrentes, utilisent cette catégorie. Archivez-la plutôt.",
  categoryExists: "Une catégorie de ce nom et de ce type existe déjà.",

  couldNotPrice: "Impossible d'obtenir le cours de ce placement.",
  couldNotSaveRecurring: "Impossible d'enregistrer l'opération récurrente",
  couldNotFillMonth: "Impossible de remplir ce mois-ci.",
  couldNotRecord: "Impossible de l'enregistrer",
  couldNotSavePosition: "Impossible d'enregistrer cette ligne.",
  couldNotRemovePosition: "Impossible de retirer cette ligne.",
  couldNotSearch: "La recherche n'a pas abouti. Réessayez.",
  couldNotFetchPrice: "Impossible d'obtenir le dernier cours. Réessayez.",
  couldNotEstimate: "Impossible d'estimer le montant au cours du jour.",
  couldNotReachBank: "Impossible de joindre la banque.",
  couldNotAddEntry: "Impossible d'ajouter cette opération",
  deleteFailed: "La suppression n'a pas abouti",

  profileUpdated: "Profil mis à jour",
  allDataDeleted:
    "Toutes vos données financières ont été supprimées. Les catégories par défaut reviendront à votre prochaine visite.",

  skipRemoved: "De retour dans le mois",

  closeTooEarly:
    "Ce mois pourra être clôturé à partir du {date}, une fois ses dernières dépenses arrivées.",
  closeRemoved: "Clôture retirée",
  capSet: "Plafond enregistré",
  readingDayUpdated: "Jour de relevé mis à jour",

  fulfilmentSetup:
    "Confirmer les opérations récurrentes demande la migration 023 — lancez-la et cela fonctionnera.",
  recurringGone: "Cette opération récurrente n'est plus là",
  movementTaken:
    "Ce mouvement correspond déjà à une autre opération récurrente",
  counted: "Comptée — elle n'est plus prévue",
  pairingDismissed: "Ce rapprochement ne sera plus proposé",
  backInForecast: "De retour dans les prévisions",
  countedForMonth: "Compté pour {month}",
  movedBack: "Remis au {date}",
  cashDateSetup:
    "Compter un revenu pour le mois suivant demande la migration 045 — lancez-la et cela fonctionnera.",

  entryNoLongerWaiting: "Cette opération n'attend plus",
  entryAlreadyDealtWith: "Cette opération a déjà été traitée",
  alreadyInLedger:
    "Déjà dans votre journal — rattachée à l'opération que vous aviez",
  leftOut: "Laissée de côté",
  entryNotInLedger: "Cette opération n'est pas dans votre journal",
  moved: "Catégorie changée",
  entryNoLongerHere: "Cette opération n'est plus là",
  entryAlreadyWaiting: "Cette opération attend déjà",
  backInInbox: "De retour parmi les opérations à vérifier",
  entriesBackInInbox: {
    one: "{count} ligne est de retour parmi les opérations à vérifier",
    other: "{count} lignes sont de retour parmi les opérations à vérifier",
  },
  suggestionGone: "Cette suggestion n'est plus proposée",
  suggestionDismissed: "Ce ne sera plus proposé",
  proposalAdded: "Opération récurrente ajoutée\u00A0: {name}",

  nothingNew: "Rien de nouveau",
  syncAdded: {
    one: "{count} opération ajoutée",
    other: "{count} opérations ajoutées",
  },
  syncAlreadySeen: { one: "{count} déjà vue", other: "{count} déjà vues" },
  syncAlreadyRecorded: {
    one: "{count} déjà enregistrée",
    other: "{count} déjà enregistrées",
  },
  syncToReview: { one: "{count} à vérifier", other: "{count} à vérifier" },
  syncMonthsClosed: {
    one: "{count} mois clôturé",
    other: "{count} mois clôturés",
  },
  syncNeedReconnect: {
    one: "{count} compte à reconnecter",
    other: "{count} comptes à reconnecter",
  },
};
