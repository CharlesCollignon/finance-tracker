import { createClient } from "@/lib/supabase/server";
import { HeroPage } from "@/components/marketing/HeroPage";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <HeroPage isLoggedIn={Boolean(user)} />;
}
