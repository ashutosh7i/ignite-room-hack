import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchUsers, type UserListItem } from "@/lib/api";

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUsers(search)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User directory</h1>
        <p className="text-muted-foreground text-sm">
          656 hackathon participants · search by name or org
        </p>
      </div>
      <input
        className="border-input bg-background w-full max-w-md rounded-lg border px-3 py-2 text-sm"
        placeholder="Search users…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="divide-y rounded-lg border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {u.firstName} {u.lastName}
                {u.demoRole && (
                  <span className="bg-primary/10 text-primary ml-2 rounded px-2 py-0.5 text-xs">
                    Demo {u.demoRole}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                {u.organization ?? "—"} · {u.jobTitle ?? "—"}
              </p>
              <p className="text-muted-foreground text-xs">
                Context: {u.contextStatus}
                {u.contextUpdatedAt
                  ? ` · updated ${new Date(u.contextUpdatedAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {u.github && (
                <a
                  className="text-muted-foreground text-xs underline"
                  href={u.github.startsWith("http") ? u.github : `https://github.com/${u.github}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              )}
              <Link
                to={`/users/${u.id}`}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                View context
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
