import Link from "next/link";
import { Button } from "@/components/retroui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded border border-border bg-card p-8 ">
        <p className="font-head text-3xl">404</p>
        <p className="mt-2 font-head text-lg">Page not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Button render={<Link href="/dashboard">Go to dashboard</Link>} />
        </div>
      </div>
    </div>
  );
}
