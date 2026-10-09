import type { taxEn } from "./tax.en";

/** The French half of `tax.en.ts`, mounted by `fr.ts` as `tax`. */
export const taxFr: typeof taxEn = {
  title: "Déclaration de revenus",
  intro:
    "Vos montants {year}, case par case, d'après ce que vous avez noté. Vérifiez chaque case sur impots.gouv.fr : Pluclair ne remplit pas votre déclaration et ne donne pas de conseil fiscal.",
  forms: "Cases des formulaires {forms}.",
  provisional:
    "Les formulaires {forms} ne sont pas encore parus : ce sont les cases de {known}. À vérifier dès leur sortie.",
  verify: "Code à vérifier sur le formulaire.",
  footer:
    "Pluclair additionne ce que vous avez noté. Il ne calcule ni impôt ni crédit : vos plafonds dépendent de votre foyer.",
  year: "Revenus {year}",
  rows: { one: "Une opération", other: "{count} opérations" },
  none: "Rien de noté pour cette case en {year}.",
  categoriesHint: "Les catégories dont les opérations vont dans cette case.",
  noCategory: "Aucune catégorie pour l'instant",
  fromPer: "Depuis vos versements sur votre PER (Placements).",
  fromRentBare: "Depuis les loyers de vos biens loués nus (Immobilier).",
  fromRentFurnished:
    "Depuis les loyers de vos biens loués meublés (Immobilier).",
  seasonTitle: "Votre déclaration de revenus",
  seasonBody: "Vos montants {year} sont prêts, case par case.",
  seasonCta: "Les voir",
  profileLink: "Déclaration de revenus",
  boxes: {
    "7UF": {
      label: "Dons aux organismes d'intérêt général",
      rule: "Réduction de 66 %, dans la limite de 20 % du revenu imposable.",
    },
    "7UD": {
      label: "Dons aux organismes d'aide aux personnes en difficulté",
      rule: "Réduction de 75 % jusqu'à {ceiling}, le reste à 66 %.",
    },
    "7DB": {
      label: "Emploi d'un salarié à domicile",
      rule: "Crédit de 50 % des sommes versées, dans la limite de {ceiling} par an, relevée selon votre foyer.",
    },
    "7GA": {
      label: "Frais de garde hors du domicile, 1er enfant de moins de 6 ans",
      rule: "Crédit de 50 %, dans la limite de {ceiling} par enfant.",
    },
    "7GB": {
      label: "Frais de garde hors du domicile, 2e enfant de moins de 6 ans",
      rule: "Crédit de 50 %, dans la limite de {ceiling} par enfant.",
    },
    "7GC": {
      label: "Frais de garde hors du domicile, 3e enfant de moins de 6 ans",
      rule: "Crédit de 50 %, dans la limite de {ceiling} par enfant.",
    },
    "6NS": {
      label: "Versements sur votre PER",
      rule: "Déductibles dans la limite du plafond épargne retraite indiqué sur votre avis d'impôt.",
    },
    "4BE": {
      label: "Loyers d'une location nue (micro-foncier)",
      rule: "Loyers bruts ; un abattement de 30 % est appliqué, s'ils ne dépassent pas {ceiling} par an.",
    },
    "5NI": {
      label: "Recettes d'une location meublée (micro-BIC)",
      rule: "Recettes brutes ; un abattement de 50 % est appliqué, jusqu'à {ceiling}.",
    },
  },
  note7UD2025:
    "Versés à partir du 14 octobre 2025 : case 7UQ, jusqu'à 2 000 €.",
};
