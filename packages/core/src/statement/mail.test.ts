import { describe, expect, it } from "vitest";
import {
  alertOf,
  bankFromSender,
  bankOfMail,
  forwardingConfirmation,
  mailText,
} from "./mail";

const ON = "2026-10-12";

function alert(from: string, subject: string, text: string) {
  return alertOf({ from, subject, text, receivedOn: ON });
}

describe("bankFromSender", () => {
  it("knows a bank by its domain, and the ones under it", () => {
    expect(bankFromSender("BoursoBank <alertes@boursobank.com>")).toBe("boursobank");
    expect(bankFromSender("noreply@info.boursorama.fr")).toBe("boursobank");
    expect(bankFromSender("alerte@ca-paris.fr")).toBe("credit-agricole");
    expect(bankFromSender("no-reply@revolut.com")).toBe("revolut");
    expect(bankFromSender("ami@gmail.com")).toBeNull();
    expect(bankFromSender("phish@boursobank.com.evil.io")).toBeNull();
  });

  it("finds the bank of an e-mail the person forwarded by hand", () => {
    expect(
      bankOfMail({
        from: "Moi <moi@gmail.com>",
        text: "---------- Message transféré ---------\nDe : LCL <alertes@lcl.fr>\nDate : 12 oct. 2026",
      }),
    ).toBe("lcl");
  });
});

describe("forwardingConfirmation", () => {
  it("reads Gmail's code and its link", () => {
    expect(
      forwardingConfirmation({
        from: "Équipe Gmail <forwarding-noreply@google.com>",
        subject: "(#123456789) Confirmation de transfert Gmail - Recevoir les e-mails de moi@gmail.com",
        text: "Code de confirmation : 123456789\n\nPour autoriser moi@gmail.com à transférer automatiquement, cliquez ici :\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123\n",
      }),
    ).toEqual({
      code: "123456789",
      link: "https://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123",
    });
  });

  it("is nothing for any other sender", () => {
    expect(
      forwardingConfirmation({ from: "x@boursobank.com", subject: "(#123456789)", text: "" }),
    ).toBeNull();
  });
});

describe("mailText", () => {
  it("keeps the words of an HTML e-mail, a line per block", () => {
    expect(
      mailText(
        "<html><head><style>p{}</style></head><body><p>Paiement de 23,50&nbsp;&euro;</p><p>chez <b>MONOPRIX</b></p></body></html>",
      ),
    ).toBe("Paiement de 23,50 €\nchez MONOPRIX");
  });
});

describe("alertOf", () => {
  it("reads a card payment: amount, shop, day and card", () => {
    const read = alert(
      "BoursoBank <alertes@boursobank.com>",
      "Alerte : paiement par carte",
      "Bonjour,\nUn paiement par carte de 23,50 € chez MONOPRIX PARIS 15 a été effectué le 11/10/2026 avec votre carte **** 4821.\nCordialement",
    );
    expect(read?.bank).toBe("boursobank");
    expect(read?.tail).toBe("4821");
    expect(read?.line).toMatchObject({
      amount: "23.50",
      creditDebitIndicator: "DBIT",
      bookingDate: "2026-10-11",
      creditorName: "MONOPRIX PARIS 15",
      remittanceInformation: "MONOPRIX PARIS 15",
    });
  });

  it("reads money in, from whom it came", () => {
    const read = alert(
      "Crédit Agricole <alertes@ca-paris.fr>",
      "Votre alerte opération",
      "Votre compte n° 00012345678 a été crédité d'un virement de 2 500,00 EUR de la part de ACME SAS le 10/10.",
    );
    expect(read?.line).toMatchObject({
      amount: "2500.00",
      creditDebitIndicator: "CRDT",
      bookingDate: "2026-10-10",
      debtorName: "ACME SAS",
    });
    expect(read?.tail).toBe("5678");
  });

  it("reads a labelled one, and keeps the day it arrived when none is said", () => {
    const read = alert(
      "no-reply@lcl.fr",
      "Opération sur votre compte",
      "Type : Prélèvement\nMontant : 85,40 €\nBénéficiaire : EDF SA\n",
    );
    expect(read?.line).toMatchObject({
      amount: "85.40",
      creditDebitIndicator: "DBIT",
      bookingDate: ON,
      creditorName: "EDF SA",
    });
  });

  it("takes a refund of a payment for money in", () => {
    const read = alert(
      "alertes@boursobank.com",
      "Remboursement",
      "Le remboursement de votre paiement chez ZALANDO de 49,90 € a été crédité.",
    );
    expect(read?.line.creditDebitIndicator).toBe("CRDT");
  });

  it("is nothing for a balance, a ceiling or a statement notice", () => {
    expect(
      alert("alertes@boursobank.com", "Alerte solde", "Le solde de votre compte est de 1 234,56 €."),
    ).toBeNull();
    expect(
      alert(
        "alertes@lcl.fr",
        "Plafond",
        "Votre plafond de paiement de 2 000 € est atteint à 80 %.",
      ),
    ).toBeNull();
    expect(
      alert("e-releve@bnpparibas.com", "Votre relevé est disponible", "Votre relevé de septembre est disponible dans votre espace client."),
    ).toBeNull();
  });

  it("is nothing from anyone but a bank, nor when the way is unclear", () => {
    expect(
      alert("promo@shop.example", "Paiement de 23,50 €", "Paiement par carte de 23,50 € chez NOUS"),
    ).toBeNull();
    expect(
      alert("alertes@boursobank.com", "Mouvement", "Mouvement de 23,50 € sur votre compte."),
    ).toBeNull();
  });

  it("counts a payment once, though subject and body both say it", () => {
    const read = alert(
      "alertes@boursobank.com",
      "Paiement de 23,50 € chez MONOP",
      "Paiement par carte de 23,50 € chez MONOP le 12/10/2026.",
    );
    expect(read?.line.amount).toBe("23.50");
  });
});
