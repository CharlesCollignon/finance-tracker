# Bank exports, anonymised

Real exports from French banks, stripped of what names their owner, so the
import can be tested against what banks actually write
(`docs/plans/EVERYDAY_PLAN.md`, phase 2). A bank's CSV preset or PDF layout
is added only once its export is here.

To add one:

1. Download an export from the bank's site or app, as it comes.
2. `node scripts/anonymise-statement.mjs <file> --name "Prénom Nom"` — once
   per name on the account, the joint holder's too. It writes
   `<file>.anon.<ext>` in the file's own encoding and prints what it
   replaced.
3. Read the result. A name the script does not know is still in it.
4. Save it here as `<bank>-<format>.<ext>`: `credit-agricole-csv.csv`,
   `bnp-ofx.ofx`, `boursobank-csv.csv`.

Never commit an export that has not been through the script and read.
