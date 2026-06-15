export function AuthDivider() {
  return (
    <div className="relative flex items-center py-2">
      <div className="flex-1 border-t-2 border-border" />
      <span className="px-3 text-xs font-medium text-muted-foreground">or</span>
      <div className="flex-1 border-t-2 border-border" />
    </div>
  );
}
