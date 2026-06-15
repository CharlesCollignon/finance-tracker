export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
