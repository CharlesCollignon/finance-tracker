import { getAuthUser } from "@/lib/auth/get-user";
import { HeroPage } from "@/components/marketing/HeroPage";

export default async function HomePage() {
  const user = await getAuthUser();
  return <HeroPage isLoggedIn={Boolean(user)} />;
}
