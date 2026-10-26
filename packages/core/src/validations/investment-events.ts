import { z } from "zod";
import { walletIdSchema } from "./investments";

export const eventKindSchema = z.enum(["buy", "sell", "dividend", "fee"]);

/** One event inside a wallet, as either app's form hands it over (080). */
export const investmentEventSchema = z.object({
  wallet: walletIdSchema,
  kind: eventKindSchema,
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate"),
  instrumentName: z.string().trim().max(200).optional(),
  instrumentSymbol: z.string().trim().max(32).optional(),
  isin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "events.isinInvalid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  quantity: z.coerce.number().nonnegative().optional(),
  amount: z.coerce.number().positive("errors.amountPositive"),
  note: z.string().trim().max(500).optional(),
});

export type InvestmentEventInput = z.input<typeof investmentEventSchema>;
