import { getAuthUser } from "@/lib/auth/get-user";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { LandingHeader } from "@/components/marketing/LandingHeader";

/**
 * The marketing shell.
 *
 * `dark` is applied here rather than on <html>, which the app's theme toggle
 * owns: these pages are dark whatever the visitor has the app set to, because
 * the logo is a lit gold sphere and it only reads as one in a dark room. The
 * class also switches every `dark:` variant inside, which is what lets the
 * device frames and the mocks render their dark treatment here while the app
 * behind the login keeps whatever theme the visitor chose.
 *
 * See the marketing block in globals.css for the tokens it brings, and for
 * the `html:has()` rule that stops overscroll flashing paper behind it.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const isLoggedIn = Boolean(user);

  return (
    <div className="dark marketing-shell relative flex min-h-dvh flex-col text-foreground">
      {/* The room the glass sits in. A backdrop blur over a flat field is
          invisible, so every translucent panel below the hero needs something
          under it to move: a fixed bed of slow light and film grain, faint
          enough that no section reads as tinted. It is behind the content and
          above the shell's own ground colour. */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="marketing-ambient" />
        <div className="marketing-grain absolute inset-0" />
      </div>

      <LandingHeader isLoggedIn={isLoggedIn} />
      <main className="flex flex-1 flex-col">{children}</main>
      <LandingFooter isLoggedIn={isLoggedIn} />
    </div>
  );
}
