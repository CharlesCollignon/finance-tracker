import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-4 md:p-8">
      <Logo size="nav" />
      <div className="w-full max-w-md md:max-w-lg">{children}</div>
    </div>
  );
}
