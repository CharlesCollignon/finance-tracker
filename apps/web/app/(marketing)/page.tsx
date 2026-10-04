import { getAuthUser } from "@/lib/auth/get-user";
import {
  LandingPage,
  heroLayoutFrom,
} from "@/components/marketing/LandingPage";

interface HomePageProps {
  /** `?hero=a|b|c`: the hero layouts being compared (temporary). */
  searchParams: Promise<{ hero?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [user, { hero }] = await Promise.all([getAuthUser(), searchParams]);
  return (
    <LandingPage isLoggedIn={Boolean(user)} heroLayout={heroLayoutFrom(hero)} />
  );
}
