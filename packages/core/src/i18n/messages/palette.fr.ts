import type { paletteEn } from "./palette.en";

/** The French half of `palette.en.ts`, mounted by `fr.ts` as `palette`. */
export const paletteFr: typeof paletteEn = {
  title: "Aller à…",
  placeholder: "Une page, un commerce, un mois, un montant…",
  hint: "↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer",
  add: "Ajouter une opération",
  addAmount: "Ajouter une opération de {amount}",
  addCharge: "Ajouter une opération récurrente",
  ask: "Poser une question",
  ledgerMonth: "Journal · {month}",
  bearingMonth: "Le point · {month}",
  shop: "{name} · Par commerce",
  charge: "{name} · Récurrents",
  category: "{name} · Par catégorie",
  empty: "Rien pour « {query} »",
};
