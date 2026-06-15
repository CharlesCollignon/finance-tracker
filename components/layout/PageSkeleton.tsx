import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded border-2 border-border bg-muted",
        className,
      )}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Bone className="h-10 w-48" />
      <div className="grid gap-3 md:grid-cols-2">
        <Bone className="h-16" />
        <Bone className="h-16" />
        <Bone className="h-32 md:col-span-2" />
        <Bone className="h-32 md:col-span-2" />
        <Bone className="h-16 md:col-span-2" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <Bone className="h-16 w-full" />
        </li>
      ))}
    </ul>
  );
}
