import Link from "next/link";
import { Button } from "@/components/retroui/Button";
import { getT } from "@/lib/locale";

/**
 * The root 404.
 *
 * A server component, so it reads the request's language the same way every
 * other page does rather than through the client context — `LocaleProvider`
 * is above it in the tree, but there is nothing here that needs to be a
 * client component in order to say four sentences.
 */
export default async function NotFound() {
  const t = await getT();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-control border border-border bg-card p-8 ">
        <p className="font-head text-3xl">404</p>
        <p className="mt-2 font-head text-lg">{t("errorPage.notFoundTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("errorPage.notFoundBody")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button render={<Link href="/">{t("errorPage.goHome")}</Link>} />
        </div>
      </div>
    </div>
  );
}
