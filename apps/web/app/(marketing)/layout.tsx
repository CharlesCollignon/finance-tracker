import { getAuthUser } from "@/lib/auth/get-user";
import { LandingColorBends } from "@/components/marketing/LandingColorBends";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { LandingHeader } from "@/components/marketing/LandingHeader";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const isLoggedIn = Boolean(user);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <LandingColorBends />
      </div>
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader isLoggedIn={isLoggedIn} />
        <main className="flex flex-1 flex-col">{children}</main>
        <LandingFooter isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
