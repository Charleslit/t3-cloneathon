import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
    </div>
  );
}