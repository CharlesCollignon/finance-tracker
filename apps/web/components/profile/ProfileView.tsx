"use client";

import { useState } from "react";
import {
  CreditCard,
  EnvelopeSimple,
  Flag,
  Key,
  SignIn,
  Tag,
  Trash,
  User,
  XCircle,
} from "@phosphor-icons/react";

import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { UserInitial } from "@/components/layout/UserInitial";
import { useToast } from "@/components/layout/ToastProvider";
import {
  PasskeysPanel,
  type PasskeyItem,
} from "@/components/profile/PasskeysPanel";
import { NotificationsRow } from "@/components/profile/NotificationsRow";
import { setCurrencyPreference, useCurrency } from "@/lib/use-currency";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import {
  deleteAccount,
  deleteAllData,
  updateProfile,
} from "@/lib/actions/profile";

interface ProfileViewProps {
  email: string;
  fullName: string;
  provider: string;
  canDeleteAccount: boolean;
  initialPasskeys: PasskeyItem[];
  /** Empty when the deployment has no VAPID key configured. */
  pushPublicKey: string;
}

/** Which row is showing its editor. One at a time, as on the phone. */
type OpenRow = "name" | "passkeys" | "wipe" | "close" | null;

/** What every action in lib/actions/profile.ts resolves to. */
type ProfileActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

const CURRENCY_LABEL = {
  EUR: "Euro (€)",
  USD: "US Dollar ($)",
} as const;

/**
 * Settings, as rows.
 *
 * This was eight cards, each with a heading, a paragraph explaining itself and
 * a button — which is a lot of reading to arrive at a switch, and it made
 * every setting look equally important. The sections and their order match the
 * phone's Profile tab so that the two do not have to be learned separately;
 * the differences are only where the platforms differ, which is biometric
 * unlock (no web equivalent) and what a notification permission means.
 */
export function ProfileView({
  pushPublicKey,
  email,
  fullName,
  provider,
  canDeleteAccount,
  initialPasskeys,
}: ProfileViewProps) {
  const { toast } = useToast();
  const currency = useCurrency();
  const [open, setOpen] = useState<OpenRow>(null);
  const [pending, setPending] = useState(false);

  function toggle(row: Exclude<OpenRow, null>) {
    setOpen((current) => (current === row ? null : row));
  }

  /**
   * Run a profile action, say what it said, and close the row if it worked.
   *
   * Called straight from the form rather than through `useActionState`, which
   * is what the phone's Profile tab does too. Closing the open row is a
   * response to a successful save, and watching the action's state from an
   * effect in order to do it is a cascading render —
   * `react-hooks/set-state-in-effect` is right about that, and the handler is
   * where the answer already is.
   */
  async function run(
    action: (
      prev: ProfileActionResult,
      data: FormData,
    ) => Promise<ProfileActionResult>,
    formData: FormData,
  ) {
    setPending(true);
    const result = await action({}, formData);
    setPending(false);
    toast(
      result.error ?? result.message ?? "Saved",
      result.error ? "error" : "success",
    );
    if (!result.error) {
      setOpen(null);
    }
  }

  /**
   * Closing the account, which reports only failure.
   *
   * On success the action redirects to /login and never returns, so there is
   * no message to show and nothing left to close.
   */
  async function closeAccount(formData: FormData) {
    setPending(true);
    const result = await deleteAccount({}, formData);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <PageHeader title="Profile" />

      <PageContainer className="flex flex-col gap-6">
        {/* Who is signed in, said once at the top rather than as three rows
            the eye has to assemble. */}
        <Card.Bezel
          className="w-full"
          innerClassName="flex flex-col items-center gap-1 p-6"
        >
          <UserInitial
            initial={(fullName || email || "?").slice(0, 1).toUpperCase()}
            name={fullName || email}
            className="size-14 text-xl"
          />
          <p className="mt-2 text-base font-semibold">
            {fullName || "No name yet"}
          </p>
          <p className={cn("text-muted-foreground", MICRO)}>{email}</p>
        </Card.Bezel>

        <ListSection title="Account">
          <ListRow
            icon={User}
            label="Name"
            value={open === "name" ? undefined : fullName || "Not set"}
            onClick={() => toggle("name")}
            expanded={
              open === "name" ? (
                <form
                  action={(data) => void run(updateProfile, data)}
                  className="flex flex-col gap-3"
                >
                  {/* Only the name. The card this replaced also showed a
                      disabled email field, which `updateProfile` never read —
                      the address comes from the identity provider and the row
                      below states it. */}
                  <Input
                    name="fullName"
                    type="text"
                    defaultValue={fullName}
                    aria-label="Display name"
                    placeholder="Your name"
                    required
                    className="text-base"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="self-start"
                    disabled={pending}
                  >
                    {pending ? "Saving…" : "Save"}
                  </Button>
                </form>
              ) : null
            }
          />
          <ListRow icon={EnvelopeSimple} label="Email" value={email} />
          <ListRow icon={SignIn} label="Signed in with" value={provider} />
        </ListSection>

        <ListSection
          title="Money"
          footer="Currency changes the symbol, not the amounts."
        >
          <ListRow icon={Tag} label="Categories" href="/categories" />
          <ListRow icon={Flag} label="Budgets & goals" href="/budgets" />
          <ListRow
            icon={CreditCard}
            label="Currency"
            value={CURRENCY_LABEL[currency]}
            onClick={() =>
              setCurrencyPreference(currency === "EUR" ? "USD" : "EUR")
            }
          />
        </ListSection>

        <ListSection
          title="Security"
          footer="Passwordless sign-in, bound to this site and stored on your device."
        >
          <ListRow
            icon={Key}
            label="Passkeys"
            onClick={() => toggle("passkeys")}
            expanded={
              open === "passkeys" ? (
                <PasskeysPanel initialPasskeys={initialPasskeys} />
              ) : null
            }
          />
        </ListSection>

        <ListSection
          title="Notifications"
          footer="This browser only — your phone has its own reminders."
        >
          <NotificationsRow publicKey={pushPublicKey} />
        </ListSection>

        <ListSection title="Data">
          <ListRow
            icon={Trash}
            label="Delete all data"
            destructive
            onClick={() => toggle("wipe")}
            expanded={
              open === "wipe" ? (
                <form
                  action={(data) => void run(deleteAllData, data)}
                  className="flex flex-col gap-3"
                >
                  <p className={cn("text-muted-foreground", MICRO)}>
                    Transactions, recurring, positions and categories. Your
                    account stays.
                  </p>
                  <Input
                    name="confirmation"
                    type="text"
                    autoComplete="off"
                    aria-label="Type DELETE to confirm"
                    placeholder="Type DELETE"
                    className="text-base"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="self-start border-destructive text-destructive"
                    disabled={pending}
                  >
                    {pending ? "Deleting…" : "Delete all my data"}
                  </Button>
                </form>
              ) : null
            }
          />
          <ListRow
            icon={XCircle}
            label="Delete account"
            destructive
            onClick={() => toggle("close")}
            expanded={
              open === "close" ? (
                <form
                  action={(data) => void closeAccount(data)}
                  className="flex flex-col gap-3"
                >
                  <p className={cn("text-muted-foreground", MICRO)}>
                    Permanent. Everything above goes with it.
                  </p>
                  {!canDeleteAccount ? (
                    <p className="text-sm text-destructive">
                      Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the
                      server (local: .env.local, production: Vercel env vars).
                    </p>
                  ) : null}
                  <Input
                    name="confirmation"
                    type="text"
                    autoComplete="off"
                    aria-label="Type DELETE to confirm"
                    placeholder="Type DELETE"
                    className="text-base"
                    disabled={!canDeleteAccount}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="self-start bg-destructive text-destructive-foreground"
                    disabled={pending || !canDeleteAccount}
                  >
                    {pending ? "Deleting…" : "Delete my account"}
                  </Button>
                </form>
              ) : null
            }
          />
        </ListSection>

        <SignOutButton className="self-start px-0" />
      </PageContainer>
    </>
  );
}
