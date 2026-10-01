import type { accountsEn } from "./accounts.en";

/** The French half of `accounts.en.ts`, mounted by `fr.ts` as `accounts`. */
export const accountsFr: typeof accountsEn = {
  shortSavings: "Épargne",
  shortLivretA: "Livret A",
  shortLdds: "LDDS",
  shortLep: "LEP",
  shortCel: "CEL",
  shortPel: "PEL",
  shortLivret: "Autre livret",
  shortPea: "PEA",
  shortCto: "CTO",
  shortAv: "Assurance vie",
  shortPer: "PER",
  shortCrypto: "Crypto",

  nameLivretA: "Livret A",
  nameLdds: "Livret de développement durable et solidaire",
  nameLep: "Livret d'épargne populaire",
  nameCel: "Compte épargne logement",
  namePel: "Plan d'épargne logement",
  nameLivret: "Livret de votre banque",

  taxFree: "Aucun : ni impôt, ni prélèvements sociaux.",
  taxCel: "Flat tax de 30 % sur les intérêts, chaque année.",
  taxPel:
    "Flat tax de 30 % sur les intérêts, chaque année : le PEL a échappé à la hausse de 2026.",
  taxLivret: "Flat tax de 31,4 % sur les intérêts, chaque année.",
  rateRegulated: "Fixé par l'État, revu le 1er février et le 1er août.",
  ratePel:
    "Un PEL garde le taux de son année d'ouverture : 2 % pour un PEL ouvert en 2026.",
  rateLivret: "Le taux de votre banque.",

  yourAccounts: "Vos comptes",
  savingsGroup: "Épargne",
  investGroup: "Placements",
  total: "Votre patrimoine",
  split: "Épargne {savings} · Placements {investments}",

  add: "Ajouter un compte",
  addTitle: "Quel compte ?",
  addBalance: "Combien y a-t-il dessus aujourd'hui ?",
  addRate: "Taux par an",
  addFromBank: "Lire le solde sur votre banque",
  addTypeIt: "Je le saisis",
  addConfirm: "Ajouter",
  added: "{name} ajouté.",
  addedSavings:
    "{name} ajouté. Ce que vous notez dans « {category} » s'y ajoute.",
  allAdded: "Vous avez déjà tous les types de comptes.",

  balanceAsOf: "au {date}",
  balanceFromBank: "lu sur votre banque le {date}",
  addedSince: "dont {amount} noté depuis",
  ratePerYear: "{rate} par an",
  interestPerYear: "≈ {amount} d'intérêts par an, après impôt",
  ceilingOf: "{balance} sur {ceiling}",
  ceilingReached: "Plafond atteint",
  monthlyPlanned: "{amount} prévus chaque mois",
  monthlyNone: "Aucun versement prévu chaque mois.",
  notLiquid:
    "Un retrait clôt le PEL : il ne compte pas dans votre coussin de sécurité.",
  categoryLine: "Ce que vous notez dans « {category} » s'ajoute au solde.",
  updateBalance: "Mettre à jour le solde",
  editRate: "Modifier le taux",
  save: "Enregistrer",
  saved: "Enregistré.",
  linkBank: "Lire le solde sur votre banque",
  unlinkBank: "Ne plus le lire sur la banque",

  remove: "Retirer ce compte",
  removeSavingsConfirm:
    "Retirer {name} ? Ses opérations restent dans le Journal.",
  removeWalletConfirm: {
    one: "Retirer {name} et sa {count} ligne ?",
    other: "Retirer {name} et ses {count} lignes ?",
  },
  removed: "{name} retiré.",

  emptyTitle: "Ajoutez vos comptes",
  emptyBody:
    "Livret A, PEL, PEA… Ajoutez ceux que vous avez, et le Plan dira ce que devient chacun.",

  breakdown: "Par compte",

  analysisIntro:
    "Ce que rapporte chaque compte, comment votre argent est réparti, et ce qu'il vous coûte.",
  returnSavings: "{rate} par an, net d'impôt",
  returnSavingsHint:
    "Un livret rapporte son taux\u00A0: ni plus-value, ni moins-value.",
  feesNone: "Sans frais",
};
