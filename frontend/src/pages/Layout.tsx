import { Link, Outlet } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Layout() {
  return (
    <div className="bg-background min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">
            EnSight
          </Link>
          <p className="text-muted-foreground hidden text-sm sm:block">
            Universal user-context layer · Demo: developer SaaS support
          </p>
          <nav className="flex gap-2">
            <Link
              to="/"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Users
            </Link>
            <Link
              to="/support"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Support demo
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
