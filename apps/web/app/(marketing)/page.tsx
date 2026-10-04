import { getAuthUser } from "@/lib/auth/get-user";
import { LandingPage } from "@/components/marketing/LandingPage";

export default async function HomePage() {
  const user = await getAuthUser();
  return <LandingPage isLoggedIn={Boolean(user)} />;
}
