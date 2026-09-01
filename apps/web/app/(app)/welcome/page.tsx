import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";

export const metadata = {
  title: "Welcome",
};

export default async function WelcomePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Defaults are seeded at sign-up, so there is something to choose from here.
  const categories = await getCategories(user.id);

  return <WelcomeFlow categories={categories.filter((c) => !c.archived)} />;
}
