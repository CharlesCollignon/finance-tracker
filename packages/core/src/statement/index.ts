/**
 * Bank statements, read with no bank connection: whatever file a person
 * downloads from their bank — CSV, Excel, OFX, QIF, CAMT, MT940, CFONB, a
 * PDF — or a picture of it their AI account reads, as the lines the bank
 * feed takes. `docs/plans/STATEMENTS_PLAN.md`.
 */
export { readStatementFile, readStatementText, tableRows } from "./read";
export { readPdfPages, type PdfPage, type PdfText } from "./pdf";
export { SCAN_SCHEMA, statementFromScan } from "./scan";
export {
  alertOf,
  forwardingConfirmation,
  mailText,
  type MailAlert,
} from "./mail";
export { messageLineId } from "./line-ids";
export {
  confirmProvisional,
  PROVISIONAL_WINDOW_DAYS,
  type ProvisionalLine,
} from "./provisional";
export { readMappedTable, type TableMapping } from "./table";
export {
  accountTail,
  initialAccountChoice,
  statementKey,
  withDirection,
  type AccountChoice,
} from "./account";
export { exportGuide } from "./guides";
export { BANK_IDS, BANK_NAMES, isBankId, type BankId } from "./banks";
export type { Statement, StatementBlock } from "./model";
