/**
 * Strings for the phone's Plan screen that the shared catalogue had no word
 * for. Kept in a file of its own while that screen was being rebuilt
 * alongside others; `en.ts` mounts it as `planScreen`.
 */
export const planScreenEn = {
  /**
   * Under the balance field of a month's close, when the phone filled it in
   * from the stored statement. The web reads the bank live and says
   * `monthClose.filledFromBank`; the phone reads the statement for the
   * reading day itself, so the advice differs.
   */
  filledFromStatement:
    "Filled in from your bank statement for {date}. Change it if it is not the right figure.",
};
