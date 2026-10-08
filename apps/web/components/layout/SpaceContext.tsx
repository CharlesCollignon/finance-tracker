"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** The shared space as the shell knows it, for the switch and the rows. */
export interface SpaceView {
  name: string;
  /** Whether the shared screens show the space (« Commun ») or the person. */
  joint: boolean;
  /** Who is in it, for the initials on the joint rows and on the switch. */
  members: { userId: string; name: string }[];
}

const SpaceContext = createContext<SpaceView | null>(null);

/**
 * The space of the person signed in, from the app shell down — null when
 * they are in none, which is every screen as it was before the space.
 */
export function SpaceProvider({
  space,
  children,
}: {
  space: SpaceView | null;
  children: ReactNode;
}) {
  return (
    <SpaceContext.Provider value={space}>{children}</SpaceContext.Provider>
  );
}

export function useSpace(): SpaceView | null {
  return useContext(SpaceContext);
}

/** The first letter of a name, for an initial in a disc. */
export function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

/**
 * Who added a joint row, as the members' map gives it — null outside the
 * joint space, or for a row nobody is named on.
 */
export function useAuthorOf(
  createdBy: string | null | undefined,
): { initial: string; name: string } | null {
  const space = useSpace();
  if (!space?.joint || !createdBy) {
    return null;
  }
  const member = space.members.find((person) => person.userId === createdBy);
  return member ? { initial: initialOf(member.name), name: member.name } : null;
}

/**
 * The initial of whoever added a joint row, on the corner of its icon —
 * nothing outside the joint space, where every row is the reader's own.
 */
export function AuthorBadge({
  createdBy,
  className,
}: {
  createdBy: string | null | undefined;
  className?: string;
}) {
  const t = useT();
  const author = useAuthorOf(createdBy);
  if (!author) {
    return null;
  }
  const label = t("space.addedBy", { name: author.name });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full",
        "border border-background bg-foreground text-[8px] font-semibold leading-none text-background",
        className,
      )}
    >
      {author.initial}
    </span>
  );
}
