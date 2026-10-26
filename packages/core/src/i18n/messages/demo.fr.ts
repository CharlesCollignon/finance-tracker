import type { demoEn } from "./demo.en";

/** `demo.en.ts`, in French. `fr.ts` mounts it as `demo`. */
export const demoFr: typeof demoEn = {
  banner:
    "Vous regardez la démo : un compte d'exemple, en lecture seule, où tout est inventé.",
  createAccount: "Créer mon compte",
};
