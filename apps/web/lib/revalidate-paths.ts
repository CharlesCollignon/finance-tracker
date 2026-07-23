import { revalidatePath } from "next/cache";

/** Pages that depend on recurring templates or derived transactions. */
export function revalidateRecurringDependents(): void {
  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/calendar");
  revalidatePath("/investments");
  revalidatePath("/dashboard");
}
