import { cn } from "@/lib/utils";

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function FormLabel({ className, children, ...props }: FormLabelProps) {
  return (
    <label className={cn("text-sm font-medium", className)} {...props}>
      {children}
    </label>
  );
}
