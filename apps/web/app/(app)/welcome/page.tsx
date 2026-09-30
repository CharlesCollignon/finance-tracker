import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";
import { shouldInviteToConnect } from "@/lib/bank/invite";

export const metadata = {
  title: "Welcome",
};

export default async function WelcomePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Defaults are seeded at sign-up, so there is something to choose from here.
  const [categories, offerBank] = await Promise.all([
    getCategories(user.id),
    shouldInviteToConnect(user.id, "welcome"),
  ]);

  return (
    <WelcomeFlow
      categories={categories.filter((c) => !c.archived)}
      offerBank={offerBank}
    />
  );
}
