export function accountLabel(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): { name: string; initial: string } {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";
  const fromEmail = user.email?.split("@")[0]?.trim() ?? "";
  const name = fullName || fromEmail || "Account";
  const initial = Array.from(name)[0]?.toUpperCase() ?? "A";
  return { name, initial };
}
