import type { placementsWebEn } from "./placements-web.en";

/** The French half of `placements-web.en.ts`, mounted by `fr.ts` as `placementsWeb`. */
export const placementsWebFr: typeof placementsWebEn = {
  setupNeeded: "Les comptes d'épargne ne sont pas encore disponibles ici.",
  alreadyAdded: "Vous avez déjà ce compte.",
  back: "Retour",
  bankPick: "Quel compte de votre banque ?",
  noReportedBalance: "pas encore de solde",
  rateLabel: "Taux",
  taxLabel: "Impôt sur les intérêts",
  ceilingLabel: "Plafond",
  monthlyLabel: "Chaque mois",

  allocationIntro: "Comment votre argent se répartit entre vos comptes.",
  shareOfMoney: "{share} de votre argent",
  targetEditorIntro:
    "Choisissez la part de votre argent que chaque compte doit détenir. Le total doit faire 100\u00A0%.",
  targetsSetup:
    "Les cibles des comptes d'épargne ne sont pas encore disponibles ici.",
  returnsSavings: "Comptes d'épargne",
  feesTitle: "Frais",
  analysisEmpty:
    "Ajoutez vos comptes dans Comptes\u00A0: ce que rapporte chacun, la répartition de votre argent et ce qu'il vous coûte s'afficheront ici.",
  analysisEmptyCta: "Aller dans Comptes",
};
