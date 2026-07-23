import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
});

export const deleteConfirmSchema = z.object({
  confirmation: z.literal("DELETE", {
    error: 'Type DELETE to confirm',
  }),
});
