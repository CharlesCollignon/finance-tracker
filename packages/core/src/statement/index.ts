/**
 * Bank statements, read with no bank connection: whatever file a person
 * downloads from their bank — CSV, Excel, OFX, QIF, CAMT, MT940, CFONB — as
 * the lines the bank feed takes. `docs/plans/STATEMENTS_PLAN.md`.
 */
export { readStatementFile, readStatementText } from "./read";
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
