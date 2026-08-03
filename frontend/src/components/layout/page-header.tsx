"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  loading?: boolean;
}

export function PageHeader({ title, description, icon: Icon, actions, loading }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border glass">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight truncate">{title}</h1>
            )}
            {description && !loading && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8", className)}>
      {children}
    </div>
  );
}