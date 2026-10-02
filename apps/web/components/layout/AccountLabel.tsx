"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AccountMenu } from "@/components/layout/AccountMenu";

interface AccountLabelValue {
  displayName: string;
  initial: string;
}

const AccountLabelContext = createContext<AccountLabelValue | null>(null);

/**
 * Who is signed in, for the account menu wherever a page draws it.
 *
 * The shell knows the name; the page header that carries the menu on a
 * phone is rendered by each page, which does not. Outside the app shell —
 * the auth and marketing headers — there is no provider and no menu.
 */
export function AccountLabelProvider({
  displayName,
  initial,
  children,
}: AccountLabelValue & { children: ReactNode }) {
  return (
    <AccountLabelContext.Provider value={{ displayName, initial }}>
      {children}
    </AccountLabelContext.Provider>
  );
}

/**
 * The account menu in the page header, on a phone only: from `md` the top
 * bar carries it. It left the bottom bar so the bar holds surfaces alone.
 */
export function HeaderAccountMenu() {
  const account = useContext(AccountLabelContext);
  if (!account) {
    return null;
  }
  // On a wrapper, as the orb is: the trigger sets its own display.
  return (
    <span className="flex md:hidden">
      <AccountMenu
        displayName={account.displayName}
        initial={account.initial}
      />
    </span>
  );
}
