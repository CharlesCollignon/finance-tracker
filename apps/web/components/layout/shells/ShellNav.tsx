"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { TopNav } from "@/components/layout/TopNav";
import { useDesign } from "@/lib/design-context";
import type { NavBadges } from "@/lib/nav-badges";
import { BentoDock, BentoRail } from "./BentoNav";
import { ConsoleBar, ConsoleTabs } from "./ConsoleNav";
import { PapierMasthead, PapierTabs } from "./PapierNav";

interface ShellNavProps {
  displayName: string;
  initial: string;
  nouveautes: number;
  badges: NavBadges;
  showProperty: boolean;
}

/**
 * The navigation around every screen, in the reader's design
 * (`docs/plans/DESIGN_LAYOUTS_PLAN.md`, layer 1): « Nuit »'s notch and
 * glass bar, « Papier »'s masthead and ruled tabs, « Bento »'s dark rail and
 * floating dock, « Console »'s command bar, list and numbered tabs. Each
 * draws the same surfaces, counts and controls (`use-nav.ts`); the page
 * makes room for whichever is on screen through `.app-main` in
 * `globals.css`.
 *
 * Read from the client's design rather than the server's, so a change in
 * the profile redraws the navigation at once, with the colours.
 */
export function ShellNav(props: ShellNavProps) {
  const { design } = useDesign();
  const narrow = { badges: props.badges, showProperty: props.showProperty };

  switch (design) {
    case "papier":
      return (
        <>
          <PapierMasthead {...props} />
          <PapierTabs {...narrow} />
        </>
      );
    case "bento":
      return (
        <>
          <BentoRail {...props} />
          <BentoDock {...narrow} />
        </>
      );
    case "console":
      return (
        <>
          <ConsoleBar {...props} />
          <ConsoleTabs {...narrow} />
        </>
      );
    default:
      return (
        <>
          <TopNav {...props} />
          <BottomNav {...narrow} />
        </>
      );
  }
}
