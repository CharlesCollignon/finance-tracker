"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { useToast } from "@/components/layout/ToastProvider";
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
}

export function ProfileView({
  email,
  fullName,
  provider,
  canDeleteAccount,
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
      <PageHeader title="Profile">
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <Card className="block w-full p-4 md:p-5">
          <h2 className="font-head text-base">Account</h2>
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
        </Card>

        <Card className="block w-full border-destructive p-4 md:p-5">
          <h2 className="font-head text-base text-destructive">Danger zone</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Delete all transactions, recurring templates, and categories.
            Your account stays active.
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
        </Card>

        <Card className="block w-full border-destructive p-4 md:p-5">
          <h2 className="font-head text-base text-destructive">
            Delete account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permanently removes your account and all finance data. This
            cannot be undone.
          </p>
          {!canDeleteAccount && (
            <p className="mt-2 text-sm text-destructive">
              Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the
              server (local: .env.local, production: Vercel env vars).
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
        </Card>

        <div className="hidden md:block">
          <SignOutButton className="px-0" />
        </div>
      </PageContainer>
    </>
  );
}
