import { describe, expect, it } from "vitest";

import { MASK_LABEL, maskPersonalData, passesLuhn } from "./entraide-mask";

describe("maskPersonalData", () => {
  it("masks an IBAN, grouped or whole, in any case", () => {
    for (const iban of [
      "FR76 3000 6000 0112 3456 7890 189",
      "FR7630006000011234567890189",
      "fr76 3000 6000 0112 3456 7890 189",
      "DE89 3704 0044 0532 0130 00",
    ]) {
      const result = maskPersonalData(`Mon IBAN : ${iban}, merci.`);
      expect(result.text).toBe(`Mon IBAN : ${MASK_LABEL.iban}, merci.`);
      expect(result.masked).toEqual(["iban"]);
    }
  });

  it("masks a card number, and tells it from another long number", () => {
    expect(maskPersonalData("carte 4111 1111 1111 1111 expirée").text).toBe(
      `carte ${MASK_LABEL.card} expirée`,
    );
    expect(maskPersonalData("client n° 12345678901").masked).toEqual([
      "account",
    ]);
  });

  it("masks email addresses", () => {
    const result = maskPersonalData(
      "Écrivez à jean.dupont+banque@exemple.fr !",
    );
    expect(result.text).toBe(`Écrivez à ${MASK_LABEL.email} !`);
    expect(result.masked).toEqual(["email"]);
  });

  it("masks French and international phone numbers", () => {
    for (const phone of [
      "06 12 34 56 78",
      "0612345678",
      "06.12.34.56.78",
      "+33 6 12 34 56 78",
      "+33612345678",
      "0033 6 12 34 56 78",
      "+44 20 7946 0958",
    ]) {
      expect(maskPersonalData(`Appelez le ${phone}.`).text).toBe(
        `Appelez le ${MASK_LABEL.phone}.`,
      );
    }
  });

  it("says each kind once, in the order first met", () => {
    const result = maskPersonalData(
      "a@b.fr puis FR76 3000 6000 0112 3456 7890 189 puis c@d.fr",
    );
    expect(result.masked).toEqual(["email", "iban"]);
  });

  it("leaves amounts, dates, postcodes and references alone", () => {
    for (const text of [
      "Un PEA est plafonné à 150 000 € (225 000 € avec un PEA-PME).",
      "J'ai 2 550,40 € sur le compte au 13/10/2026.",
      "Le décret n° 2021-1362 du 20 octobre 2021.",
      "Paris 75011, à 18,6 % de prélèvements sociaux.",
      "En 2025, j'ai versé 4 710 € sur mon PER.",
      "Mon livret A est à 1,7 %.",
      "FR12 est le nom de mon dossier.",
    ]) {
      expect(maskPersonalData(text)).toEqual({ text, masked: [] });
    }
  });
});

describe("passesLuhn", () => {
  it("accepts a valid card number and refuses one digit off", () => {
    expect(passesLuhn("4111111111111111")).toBe(true);
    expect(passesLuhn("4111111111111112")).toBe(false);
  });
});
