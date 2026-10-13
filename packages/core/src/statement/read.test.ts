import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { readStatementFile, readStatementText } from "./read";
import type { Statement } from "./model";

/**
 * Each format and each bank's shape, read end to end. The samples are
 * written for these tests in each bank's layout as known in October 2026,
 * with made-up names and numbers; real anonymised exports go to
 * `fixtures/statements/` as they arrive, and replace them.
 */

const bytes = (text: string) => new TextEncoder().encode(text);

/** Windows-1252 bytes: Latin-1, with « € » at 0x80. */
function windows1252(text: string): Uint8Array {
  return Uint8Array.from(text, (char) =>
    char === "€" ? 0x80 : char.charCodeAt(0),
  );
}

function lines(statement: Statement, block = 0) {
  return statement.blocks[block]!.lines.map((line) => ({
    date: line.bookingDate,
    amount: `${line.creditDebitIndicator === "DBIT" ? "-" : ""}${line.amount}`,
    label: line.remittanceInformation,
  }));
}

describe("CSV, by bank", () => {
  it("BoursoBank: every account in one file, its merchant named", () => {
    const statement = readStatementText(
      [
        "dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance",
        '2026-10-02;2026-10-02;"CARTE 01/10/26 MONOP PARIS CB*1234";"Alimentation";"Vie quotidienne";"monop";"-23,45";;00012345678;"Compte BoursoBank";1500,00',
        '2026-10-01;2026-10-01;"VIR SEPA SALAIRE ACME";"Salaires";"Revenus";"acme";"2 500,00";;00012345678;"Compte BoursoBank";1500,00',
        '2026-10-03;2026-10-03;"VIR LIVRET";"Epargne";"Epargne";"";"100,00";;00098765432;"Livret";5000,00',
      ].join("\n"),
    );
    expect(statement.format).toBe("csv");
    expect(statement.bank).toBe("boursobank");
    expect(statement.blocks).toHaveLength(2);
    expect(statement.blocks[0]!.account).toEqual({
      iban: null,
      number: "00012345678",
      name: "Compte BoursoBank",
    });
    expect(lines(statement)).toEqual([
      {
        date: "2026-10-02",
        amount: "-23.45",
        label: "CARTE 01/10/26 MONOP PARIS CB*1234",
      },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SEPA SALAIRE ACME" },
    ]);
    expect(statement.blocks[0]!.lines[0]!.creditorName).toBe("monop");
    // The account's balance on the export's day is not a running balance.
    expect(statement.blocks[0]!.lines[0]!.balanceAfterTransaction).toBeNull();
  });

  it("Crédit Agricole: Windows-1252, lines above the header, debit and credit apart", () => {
    const statement = readStatementFile(
      windows1252(
        [
          "Téléchargement du 13/10/2026;",
          "Crédit Agricole Paris;",
          "Compte de Dépôt n° 12345678901;",
          "Solde au 13/10/2026 1 234,56 €;",
          "",
          "Liste des opérations du compte entre le 01/09/2026 et le 13/10/2026;",
          "",
          "Date;Libellé;Débit euros;Crédit euros;",
          '02/10/2026;"PAIEMENT PAR CARTE X1234 MONOP PARIS 01/10";23,45;;',
          '01/10/2026;"VIREMENT EN VOTRE FAVEUR ACME";;2 500,00;',
        ].join("\r\n"),
      ),
    );
    expect(statement.bank).toBe("credit-agricole");
    expect(statement.blocks[0]!.account?.number).toBe("12345678901");
    expect(statement.blocks[0]!.closing).toEqual({
      date: "2026-10-13",
      amount: "1234.56",
    });
    expect(lines(statement)).toEqual([
      {
        date: "2026-10-02",
        amount: "-23.45",
        label: "PAIEMENT PAR CARTE X1234 MONOP PARIS 01/10",
      },
      {
        date: "2026-10-01",
        amount: "2500.00",
        label: "VIREMENT EN VOTRE FAVEUR ACME",
      },
    ]);
    expect(statement.blocks[0]!.signUnknown).toBe(false);
  });

  it("Société Générale: the detail kept once, not after the label it repeats", () => {
    const statement = readStatementText(
      [
        '="000123456789";',
        "Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise",
        "02/10/2026;CARTE X1234 01/10 MONOP;CARTE X1234 01/10 MONOP PARIS 15;-23,45;EUR",
        "01/10/2026;VIR RECU 1234;DE: ACME SALAIRE OCTOBRE;2500,00;EUR",
      ].join("\n"),
    );
    expect(statement.bank).toBe("societe-generale");
    expect(lines(statement)).toEqual([
      {
        date: "2026-10-02",
        amount: "-23.45",
        label: "CARTE X1234 01/10 MONOP PARIS 15",
      },
      {
        date: "2026-10-01",
        amount: "2500.00",
        label: "VIR RECU 1234 DE: ACME SALAIRE OCTOBRE",
      },
    ]);
  });

  it("Banque Populaire: its long header, debit and credit columns", () => {
    const statement = readStatementText(
      [
        "Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation",
        "02/10/2026;MONOP;CB MONOP 01/10;REF1;;Carte bancaire;Alimentation;Courses;-23,45;;01/10/2026;02/10/2026;0",
        "01/10/2026;ACME;VIR SEPA ACME;REF2;SALAIRE;Virement;Revenus;Salaire;;2500,00;01/10/2026;01/10/2026;0",
      ].join("\n"),
    );
    expect(statement.bank).toBe("banque-populaire");
    expect(lines(statement)).toEqual([
      { date: "2026-10-01", amount: "-23.45", label: "CB MONOP 01/10" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SEPA ACME SALAIRE" },
    ]);
    expect(statement.blocks[0]!.lines[0]!.valueDate).toBe("2026-10-02");
  });

  it("Revolut: completed lines only, the fee on top", () => {
    const statement = readStatementText(
      [
        "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
        "TOPUP,Current,2026-10-01 09:00:00,2026-10-01 09:00:01,Top-Up by *1234,500.00,0.00,EUR,COMPLETED,500.00",
        "CARD_PAYMENT,Current,2026-10-01 12:00:00,2026-10-02 08:00:00,Monop,-23.45,0.00,EUR,COMPLETED,476.55",
        "CARD_PAYMENT,Current,2026-10-03 12:00:00,,Amazon,-10.00,0.00,EUR,PENDING,",
        "EXCHANGE,Current,2026-10-04 10:00:00,2026-10-04 10:00:00,Exchanged to USD,-100.00,0.50,EUR,COMPLETED,376.05",
      ].join("\n"),
    );
    expect(statement.bank).toBe("revolut");
    expect(statement.skipped).toBe(0);
    expect(lines(statement)).toEqual([
      { date: "2026-10-01", amount: "500.00", label: "Top-Up by *1234" },
      { date: "2026-10-02", amount: "-23.45", label: "Monop" },
      { date: "2026-10-04", amount: "-100.50", label: "Exchanged to USD" },
    ]);
    expect(statement.blocks[0]!.lines[1]!.balanceAfterTransaction).toBe(
      "476.55",
    );
  });

  it("N26: the partner named, the reference as the words", () => {
    const statement = readStatementText(
      [
        '"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
        '"2026-10-02","2026-10-02","MONOP","","Presentment","","Compte principal","-23.45","","",""',
        '"2026-10-01","2026-10-01","ACME SAS","FR7612345000010000000000123","Credit Transfer","Salaire octobre","Compte principal","2500.00","","",""',
      ].join("\n"),
    );
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "MONOP" },
      { date: "2026-10-01", amount: "2500.00", label: "Salaire octobre" },
    ]);
    expect(statement.blocks[0]!.lines[1]!.debtorName).toBe("ACME SAS");
  });

  it("La Banque Postale: the account and balance written above", () => {
    const statement = readStatementText(
      [
        "Numéro Compte ;0123456A020",
        "Type ;CCP",
        "Compte tenu en ;euros",
        "Date ;13/10/2026",
        "Solde (EUROS) ;1 234,56",
        "",
        "Date;Libellé;Montant(EUROS)",
        '02/10/2026;"ACHAT CB MONOP 01.10.26";-23,45',
      ].join("\n"),
    );
    expect(statement.blocks[0]!.account?.number).toBe("0123456A020");
    expect(statement.blocks[0]!.closing?.amount).toBe("1234.56");
    expect(lines(statement)).toEqual([
      {
        date: "2026-10-02",
        amount: "-23.45",
        label: "ACHAT CB MONOP 01.10.26",
      },
    ]);
  });
});

describe("CSV, by content", () => {
  it("finds the columns of a file without a header, its running balance apart", () => {
    const statement = readStatementText(
      [
        "02/10/2026;CB MONOP;-23,45;976,55",
        "03/10/2026;PRLV FREE MOBILE;-19,99;956,56",
        "05/10/2026;VIR SALAIRE;2500,00;3456,56",
      ].join("\n"),
    );
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP" },
      { date: "2026-10-03", amount: "-19.99", label: "PRLV FREE MOBILE" },
      { date: "2026-10-05", amount: "2500.00", label: "VIR SALAIRE" },
    ]);
    expect(statement.blocks[0]!.lines[2]!.balanceAfterTransaction).toBe(
      "3456.56",
    );
  });

  it("finds debit and credit apart without a header", () => {
    const statement = readStatementText(
      ["02/10/2026,CB MONOP,23.45,", "01/10/2026,VIR SALAIRE,,2500.00"].join(
        "\n",
      ),
    );
    expect(lines(statement).map((line) => line.amount)).toEqual([
      "-23.45",
      "2500.00",
    ]);
  });

  it("reads a sign written apart", () => {
    const statement = readStatementText(
      [
        "Date;Libellé;Montant;Sens",
        "02/10/2026;CB MONOP;23,45;D",
        "01/10/2026;VIR SALAIRE;2500,00;C",
      ].join("\n"),
    );
    expect(lines(statement).map((line) => line.amount)).toEqual([
      "-23.45",
      "2500.00",
    ]);
    expect(statement.blocks[0]!.signUnknown).toBe(false);
  });

  it("says when nothing tells which way the money went", () => {
    const statement = readStatementText(
      [
        "Date;Libellé;Montant",
        "02/10/2026;CB MONOP;23,45",
        "03/10/2026;FREE MOBILE;19,99",
      ].join("\n"),
    );
    expect(statement.blocks[0]!.signUnknown).toBe(true);
  });

  it("reads month-first dates when the column says so", () => {
    const statement = readStatementText(
      [
        "Date,Description,Amount",
        "10/25/2026,Coffee,-3.50",
        "10/02/2026,Pay,1000.00",
      ].join("\n"),
    );
    expect(lines(statement).map((line) => line.date)).toEqual([
      "2026-10-25",
      "2026-10-02",
    ]);
  });

  it("hands back the rows when the columns cannot be told apart", () => {
    const statement = readStatementText(["a;b;c", "x;y;z", "1;2;3"].join("\n"));
    expect(statement.problem).toBe("columns");
    expect(statement.table).toEqual([
      ["a", "b", "c"],
      ["x", "y", "z"],
      ["1", "2", "3"],
    ]);
  });

  it("counts a row it could not read, and not a totals line", () => {
    const statement = readStatementText(
      [
        "Date;Libellé;Montant",
        "02/10/2026;CB MONOP;-23,45",
        "03/10/2026;FREE MOBILE;n/a",
        ";Total;-23,45",
      ].join("\n"),
    );
    expect(statement.blocks[0]!.lines).toHaveLength(1);
    expect(statement.skipped).toBe(1);
  });

  it("reads UTF-16, as some exports are written", () => {
    const text = "﻿Date;Libellé;Montant\r\n02/10/2026;CB MONOP;-23,45\r\n";
    const utf16 = new Uint8Array(text.length * 2);
    for (let index = 0; index < text.length; index += 1) {
      utf16[index * 2] = text.charCodeAt(index) & 0xff;
      utf16[index * 2 + 1] = text.charCodeAt(index) >> 8;
    }
    const statement = readStatementFile(utf16);
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP" },
    ]);
  });
});

describe("tables that are not CSV", () => {
  it("reads a web page's table, the account above it", () => {
    const statement = readStatementFile(
      bytes(
        `<html><body><h1>Compte courant FR76 3000 4000 0312 3456 7890 143</h1>
        <table><tr><th>Date</th><th>Libell&eacute;</th><th>Montant</th></tr>
        <tr><td>02/10/2026</td><td>CB&nbsp;MONOP</td><td>-23,45</td></tr>
        <tr><td>01/10/2026</td><td>VIR SALAIRE</td><td>2&nbsp;500,00</td></tr></table></body></html>`,
      ),
    );
    expect(statement.format).toBe("html");
    expect(statement.bank).toBe("bnp-paribas");
    expect(statement.blocks[0]!.account?.iban).toBe(
      "FR7630004000031234567890143",
    );
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SALAIRE" },
    ]);
  });

  it("reads an Excel workbook, its dates as dates", () => {
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
      <row r="2"><c r="A2" s="1"><v>46297</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>-23.45</v></c></row>
      <row r="3"><c r="A3" s="1"><v>46296</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>2500</v></c></row>
    </sheetData></worksheet>`;
    const workbook = zipSync({
      "xl/workbook.xml": strToU8(
        '<workbook xmlns:r="r"><sheets><sheet name="Feuil1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><t>Date</t></si><si><t>Libellé</t></si><si><t>Montant</t></si><si><t>CB MONOP</t></si><si><r><t>VIR </t></r><r><t>SALAIRE</t></r></si></sst>",
      ),
      "xl/styles.xml": strToU8(
        '<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    });
    const statement = readStatementFile(workbook);
    expect(statement.format).toBe("xlsx");
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SALAIRE" },
    ]);
  });

  it("reads an OpenDocument spreadsheet", () => {
    const cell = (type: string, value: string) =>
      type === "date"
        ? `<table:table-cell office:value-type="date" office:date-value="${value}"><text:p>${value}</text:p></table:table-cell>`
        : type === "float"
          ? `<table:table-cell office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`
          : `<table:table-cell office:value-type="string"><text:p>${value}</text:p></table:table-cell>`;
    const content = `<office:document-content><office:body><office:spreadsheet><table:table table:name="Feuille1">
      <table:table-row>${cell("string", "Date")}${cell("string", "Libellé")}${cell("string", "Montant")}</table:table-row>
      <table:table-row>${cell("date", "2026-10-02")}${cell("string", "CB MONOP")}${cell("float", "-23.45")}</table:table-row>
      <table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="3"/></table:table-row>
    </table:table></office:spreadsheet></office:body></office:document-content>`;
    const statement = readStatementFile(
      zipSync({
        mimetype: strToU8("application/vnd.oasis.opendocument.spreadsheet"),
        "content.xml": strToU8(content),
      }),
    );
    expect(statement.format).toBe("ods");
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP" },
    ]);
  });
});

describe("OFX", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261013<LANGUAGE>FRA</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>EUR
<BANKACCTFROM><BANKID>30004<BRANCHID>00012<ACCTID>12345678901<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261013
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-23,45<FITID>A1<NAME>CB MONOP<MEMO>PARIS 15</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001<TRNAMT>2500.00<FITID>A2<NAME>VIR SALAIRE ACME</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1234.56<DTASOF>20261013</LEDGERBAL>
</STMTRS></STMTTRNRS>
<STMTTRNRS><TRNUID>2<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>EUR
<BANKACCTFROM><BANKID>30004<BRANCHID>00012<ACCTID>98765432100<ACCTTYPE>SAVINGS</BANKACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>100,00<FITID>B1<NAME>VIR LIVRET</STMTTRN></BANKTRANLIST>
<LEDGERBAL><BALAMT>5100<DTASOF>20261013</LEDGERBAL>
</STMTRS></STMTTRNRS>
</BANKMSGSRSV1></OFX>`;

  it("reads each account, its period and its balance", () => {
    const statement = readStatementFile(bytes(ofx));
    expect(statement.format).toBe("ofx");
    expect(statement.bank).toBe("bnp-paribas");
    expect(statement.blocks).toHaveLength(2);
    const [current, savings] = statement.blocks;
    expect(current!.account?.number).toBe("300040001212345678901");
    expect(current!.from).toBe("2026-10-01");
    expect(current!.to).toBe("2026-10-13");
    expect(current!.closing).toEqual({ date: "2026-10-13", amount: "1234.56" });
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP PARIS 15" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SALAIRE ACME" },
    ]);
    expect(savings!.lines).toHaveLength(1);
    expect(savings!.closing?.amount).toBe("5100.00");
  });
});

describe("QIF", () => {
  it("reads a French one, day first", () => {
    const statement = readStatementText(
      [
        "!Type:Bank",
        "D02/10/2026",
        "T-23,45",
        "PCB MONOP",
        "MPARIS 15",
        "^",
        "D01/10/2026",
        "T2 500,00",
        "PVIR SALAIRE",
        "^",
      ].join("\n"),
    );
    expect(statement.format).toBe("qif");
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP PARIS 15" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SALAIRE" },
    ]);
  });

  it("reads Quicken's month-first dates with their apostrophe", () => {
    const statement = readStatementText(
      [
        "!Type:Bank",
        "D10/25'26",
        "T-23.45",
        "PMONOP",
        "^",
        "D10/1'26",
        "T100.00",
        "PDEPOSIT",
        "^",
      ].join("\n"),
    );
    expect(lines(statement).map((line) => line.date)).toEqual([
      "2026-10-25",
      "2026-10-01",
    ]);
  });
});

describe("CAMT.053", () => {
  const camt = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
<BkToCstmrStmt><GrpHdr><MsgId>1</MsgId></GrpHdr>
<Stmt><Id>S1</Id>
<FrToDt><FrDtTm>2026-10-01T00:00:00</FrDtTm><ToDtTm>2026-10-31T23:59:59</ToDtTm></FrToDt>
<Acct><Id><IBAN>FR7630004000031234567890143</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-09-30</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">3476.55</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-31</Dt></Dt></Bal>
<Ntry><Amt Ccy="EUR">23.45</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-10-02</Dt></BookgDt><ValDt><Dt>2026-10-02</Dt></ValDt>
<NtryDtls><TxDtls><RltdPties><Cdtr><Nm>MONOP</Nm></Cdtr></RltdPties><RmtInf><Ustrd>CB MONOP PARIS 15</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="EUR">2500.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>2026-10-01</Dt></BookgDt>
<NtryDtls><TxDtls><RltdPties><Dbtr><Nm>ACME SAS</Nm></Dbtr><DbtrAcct><Id><IBAN>FR7612345000010000000000123</IBAN></Id></DbtrAcct></RltdPties><RmtInf><Ustrd>SALAIRE OCTOBRE</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>PDNG</Sts><BookgDt><Dt>2026-10-03</Dt></BookgDt></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

  it("reads booked entries, both balances and the parties", () => {
    const statement = readStatementText(camt);
    expect(statement.format).toBe("camt");
    expect(statement.bank).toBe("bnp-paribas");
    const block = statement.blocks[0]!;
    expect(block.account?.iban).toBe("FR7630004000031234567890143");
    expect(block.opening).toEqual({ date: "2026-09-30", amount: "1000.00" });
    expect(block.closing).toEqual({ date: "2026-10-31", amount: "3476.55" });
    expect(block.from).toBe("2026-10-01");
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP PARIS 15" },
      { date: "2026-10-01", amount: "2500.00", label: "SALAIRE OCTOBRE" },
    ]);
    expect(block.lines[0]!.creditorName).toBe("MONOP");
    expect(block.lines[1]!.debtorIban).toBe("FR7612345000010000000000123");
    expect(block.check).toEqual({ ok: true, gap: "0.00" });
  });

  it("says when its lines fall short of its balances", () => {
    const short = camt.replace(/<Ntry><Amt Ccy="EUR">23\.45[\s\S]*?<\/Ntry>/, "");
    const block = readStatementText(short).blocks[0]!;
    expect(block.check).toEqual({ ok: false, gap: "-23.45" });
  });

  it("reads one written with prefixed names", () => {
    const prefixed = camt
      .replace(/<(\/?)([A-Za-z])/g, "<$1ns2:$2")
      .replace("<ns2:?xml", "<?xml");
    expect(lines(readStatementText(prefixed))).toHaveLength(2);
  });
});

describe("MT940", () => {
  it("reads lines, their words and both balances", () => {
    const statement = readStatementText(
      [
        ":20:STMT1",
        ":25:FR7630004000031234567890143",
        ":28C:1/1",
        ":60F:C260930EUR1000,00",
        ":61:2610021002D23,45NMSCNONREF",
        ":86:CB MONOP PARIS 15",
        ":61:2610011001C2500,00NTRFNONREF//B1",
        ":86:VIR SALAIRE",
        "ACME OCTOBRE",
        ":62F:C261031EUR3476,55",
        "-",
      ].join("\r\n"),
    );
    expect(statement.format).toBe("mt940");
    const block = statement.blocks[0]!;
    expect(block.account?.iban).toBe("FR7630004000031234567890143");
    expect(block.opening).toEqual({ date: "2026-09-30", amount: "1000.00" });
    expect(block.closing).toEqual({ date: "2026-10-31", amount: "3476.55" });
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP PARIS 15" },
      {
        date: "2026-10-01",
        amount: "2500.00",
        label: "VIR SALAIRE ACME OCTOBRE",
      },
    ]);
    expect(block.check?.ok).toBe(true);
  });
});

describe("CFONB 120", () => {
  /** One 120-character record, its amount signed in its last digit. */
  function record(
    code: string,
    { date = "021026", label = "", amount = 0, value = "021026" } = {},
  ): string {
    const cents = Math.round(Math.abs(amount) * 100)
      .toString()
      .padStart(14, "0");
    const last = Number(cents[13]);
    const signed =
      cents.slice(0, 13) + (amount < 0 ? "}JKLMNOPQR" : "{ABCDEFGHI")[last];
    const text =
      code +
      "30004" +
      "    " +
      "00012" +
      "EUR" +
      "2" +
      " " +
      "12345678901" +
      "  " +
      date +
      "  " +
      value +
      label.padEnd(31).slice(0, 31) +
      "  " +
      "0000001" +
      " " +
      " " +
      signed +
      "".padEnd(16);
    expect(text).toHaveLength(120);
    return text;
  }

  it("reads balances, lines and their extra words", () => {
    const more =
      record("05", { label: "" }).slice(0, 48) + "PARIS 15".padEnd(70) + "  ";
    const file = [
      record("01", { date: "300926", amount: 1000 }),
      record("04", { date: "021026", label: "CB MONOP", amount: -23.45 }),
      more,
      record("04", { date: "011026", label: "VIR SALAIRE", amount: 2500 }),
      record("07", { date: "311026", amount: 3476.55 }),
    ].join("\r\n");
    const statement = readStatementText(file);
    expect(statement.format).toBe("cfonb");
    expect(statement.bank).toBe("bnp-paribas");
    const block = statement.blocks[0]!;
    expect(block.opening).toEqual({ date: "2026-09-30", amount: "1000.00" });
    expect(block.closing).toEqual({ date: "2026-10-31", amount: "3476.55" });
    expect(lines(statement)).toEqual([
      { date: "2026-10-02", amount: "-23.45", label: "CB MONOP PARIS 15" },
      { date: "2026-10-01", amount: "2500.00", label: "VIR SALAIRE" },
    ]);
    expect(block.check?.ok).toBe(true);
  });
});

describe("what is read elsewhere", () => {
  it("names a PDF, an old Excel and an image, and reads none of them here", () => {
    for (const [head, format] of [
      [[0x25, 0x50, 0x44, 0x46, 0x2d], "pdf"],
      [[0xd0, 0xcf, 0x11, 0xe0, 0xa1], "xls"],
      [[0x89, 0x50, 0x4e, 0x47, 0x0d], "image"],
      [[0xff, 0xd8, 0xff, 0xe0, 0x00], "image"],
    ] as const) {
      const statement = readStatementFile(Uint8Array.from(head));
      expect(statement.format).toBe(format);
      expect(statement.problem).toBe("notHere");
    }
  });

  it("says when a file is empty", () => {
    expect(readStatementFile(new Uint8Array()).problem).toBe("empty");
    expect(readStatementText("   \n").problem).toBe("empty");
  });
});
