"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { CurrencyToggle } from "@/components/profile/CurrencyToggle";
import { useToast } from "@/components/layout/ToastProvider";
import {
  PasskeysCard,
  type PasskeyItem,
} from "@/components/profile/PasskeysCard";
import { NotificationsCard } from "@/components/profile/NotificationsCard";
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

export function ProfileView({
  pushPublicKey,
  email,
  fullName,
  provider,
  canDeleteAccount,
  initialPasskeys,
}: ProfileViewProps) {
  const { toast } = useToast();
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    {},
  );
  const [dataState, dataAction, dataPending] = useActionState(
    deleteAllData,
    {},
  );
  const [accountState, accountAction, accountPending] = useActionState(
    deleteAccount,
    {},
  );

  useEffect(() => {
    if (profileState.success && profileState.message) {
      toast(profileState.message, "success");
    }
    if (profileState.error) {
      toast(profileState.error, "error");
    }
  }, [profileState, toast]);

  useEffect(() => {
    if (dataState.success && dataState.message) {
      toast(dataState.message, "success");
    }
    if (dataState.error) {
      toast(dataState.error, "error");
    }
  }, [dataState, toast]);

  useEffect(() => {
    if (accountState.error) {
      toast(accountState.error, "error");
    }
  }, [accountState, toast]);

  return (
    <>
      <PageHeader title="Profile" />

      <PageContainer className="flex flex-col gap-4">
        <Card.Bezel className="w-full" innerClassName="p-4 md:p-5">
          <h2 className="text-base font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in via {provider}
          </p>
          <form action={profileAction} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                disabled
                className="text-base opacity-70"
              />
            </div>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="fullName">Display name</FormLabel>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={fullName}
                required
                className="text-base"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto"
              disabled={profilePending}
            >
              {profilePending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Card.Bezel>

        <PasskeysCard initialPasskeys={initialPasskeys} />

        <NotificationsCard publicKey={pushPublicKey} />

        <Card.Bezel className="w-full" innerClassName="p-4 md:p-5">
          <h2 className="text-base font-semibold">Currency</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how amounts are labeled across the app. This only changes the
            symbol — it does not convert your numbers.
          </p>
          <CurrencyToggle className="mt-4" />
        </Card.Bezel>

        <Card.Bezel className="w-full" innerClassName="p-4 md:p-5">
          <h2 className="text-base font-semibold">Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, rename, archive, and organise your income, expense, savings,
            and investment categories.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-4 w-full md:w-auto"
            render={<Link href="/categories">Manage categories</Link>}
          />
        </Card.Bezel>

        <Card.Bezel className="w-full" innerClassName="p-4 md:p-5">
          <h2 className="text-base font-semibold">Budgets, goals & tags</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set monthly spending caps, savings goals, and tags for organising
            transactions.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-4 w-full md:w-auto"
            render={<Link href="/budgets">Open planning</Link>}
          />
        </Card.Bezel>

        <Card.Bezel
          className="w-full border-destructive/40"
          innerClassName="p-4 md:p-5"
        >
          <h2 className="text-base font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Delete all transactions, recurring templates, and categories. Your
            account stays active.
          </p>
          <form action={dataAction} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="data-confirm">
                Type DELETE to confirm
              </FormLabel>
              <Input
                id="data-confirm"
                name="confirmation"
                type="text"
                autoComplete="off"
                placeholder="DELETE"
                className="text-base"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full border-destructive text-destructive md:w-auto"
              disabled={dataPending}
            >
              {dataPending ? "Deleting…" : "Delete all my data"}
            </Button>
          </form>
        </Card.Bezel>

        <Card.Bezel
          className="w-full border-destructive/40"
          innerClassName="p-4 md:p-5"
        >
          <h2 className="text-base font-semibold text-destructive">
            Delete account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permanently removes your account and all finance data. This cannot
            be undone.
          </p>
          {!canDeleteAccount && (
            <p className="mt-2 text-sm text-destructive">
              Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server
              (local: .env.local, production: Vercel env vars).
            </p>
          )}
          <form action={accountAction} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="account-confirm">
                Type DELETE to confirm
              </FormLabel>
              <Input
                id="account-confirm"
                name="confirmation"
                type="text"
                autoComplete="off"
                placeholder="DELETE"
                className="text-base"
                disabled={!canDeleteAccount}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full bg-destructive text-destructive-foreground md:w-auto"
              disabled={accountPending || !canDeleteAccount}
            >
              {accountPending ? "Deleting…" : "Delete my account"}
            </Button>
          </form>
        </Card.Bezel>

        <SignOutButton className="px-0" />
      </PageContainer>
    </>
  );
}
