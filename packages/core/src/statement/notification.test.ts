import { describe, expect, it } from "vitest";
import {
  bankFromPackage,
  notificationAlert,
  notificationLines,
  type BankNotification,
} from "./notification";

function posted(
  packageName: string,
  title: string,
  text: string,
  postedAt = 1_760_000_000_000,
): BankNotification {
  return { packageName, title, text, postedOn: "2026-10-12", postedAt };
}

describe("bankFromPackage", () => {
  it("knows the bank apps, and nothing else", () => {
    expect(bankFromPackage("com.boursorama.android.clients")).toBe(
      "boursobank",
    );
    expect(bankFromPackage("DE.NUMBER26.ANDROID")).toBe("n26");
    expect(bankFromPackage("com.whatsapp")).toBeNull();
  });
});

describe("notificationAlert", () => {
  it("reads a card payment as a line out, the day it says", () => {
    const alert = notificationAlert(
      posted(
        "com.boursorama.android.clients",
        "Paiement par carte",
        "Paiement de 12,30 € chez MONOP' le 11/10 avec votre carte **** 4821.",
      ),
    );
    expect(alert).not.toBeNull();
    expect(alert!.bank).toBe("boursobank");
    expect(alert!.tail).toBe("4821");
    expect(alert!.line.amount).toBe("12.30");
    expect(alert!.line.creditDebitIndicator).toBe("DBIT");
    expect(alert!.line.bookingDate).toBe("2026-10-11");
    expect(alert!.line.creditorName).toBe("MONOP'");
  });

  it("reads money received, and dates it the day it was posted when it says no day", () => {
    const alert = notificationAlert(
      posted(
        "de.number26.android",
        "N26",
        "Vous avez reçu 250,00 € de la part de ACME SARL.",
      ),
    );
    expect(alert!.line.amount).toBe("250.00");
    expect(alert!.line.creditDebitIndicator).toBe("CRDT");
    expect(alert!.line.debtorName).toBe("ACME SARL");
    expect(alert!.line.bookingDate).toBe("2026-10-12");
  });

  it("drops what is not an operation, and apps that are not a bank", () => {
    expect(
      notificationAlert(
        posted(
          "com.boursorama.android.clients",
          "Solde",
          "Votre solde est de 1 234,56 €.",
        ),
      ),
    ).toBeNull();
    expect(
      notificationAlert(posted("com.whatsapp", "Marie", "Tu me dois 12 € !")),
    ).toBeNull();
  });

  it("gives the same line the same id, and two postings two ids", () => {
    const one = notificationAlert(
      posted(
        "com.boursorama.android.clients",
        "Paiement",
        "Paiement de 3,50 € chez CAFE le 12/10.",
        1,
      ),
    );
    const same = notificationAlert(
      posted(
        "com.boursorama.android.clients",
        "Paiement",
        "Paiement de 3,50 € chez CAFE le 12/10.",
        1,
      ),
    );
    const again = notificationAlert(
      posted(
        "com.boursorama.android.clients",
        "Paiement",
        "Paiement de 3,50 € chez CAFE le 12/10.",
        2,
      ),
    );
    expect(one!.line.id).toBe(same!.line.id);
    expect(one!.line.id).not.toBe(again!.line.id);
  });
});

describe("notificationLines", () => {
  it("keeps the lines that read, the bank, and counts the rest", () => {
    const read = notificationLines([
      posted(
        "com.boursorama.android.clients",
        "Paiement",
        "Paiement de 3,50 € chez CAFE le 12/10.",
      ),
      posted(
        "com.boursorama.android.clients",
        "Info",
        "Votre plafond de paiement est de 2 000 €.",
      ),
      posted("com.whatsapp", "Marie", "12 €"),
    ]);
    expect(read.lines).toHaveLength(1);
    expect(read.bank).toBe("boursobank");
    expect(read.skipped).toBe(2);
  });
});
