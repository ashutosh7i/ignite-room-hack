import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type HealthResponse = {
  ok: boolean;
  service: string;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = () => {
    setLoading(true);
    setError(null);
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: unknown) => {
        setHealth(null);
        setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Ignite Room Hack
        </h1>
        <p className="text-muted-foreground text-sm">
          Express backend + Vite React with shadcn/ui
        </p>
      </div>

      <Button type="button" onClick={loadHealth} disabled={loading}>
        {loading ? "Checking…" : "Refresh health"}
      </Button>

      <div className="bg-muted min-w-[280px] rounded-lg border p-4 text-left text-sm">
        {loading && !health && !error && (
          <p className="text-muted-foreground">Loading backend status…</p>
        )}
        {error && <p className="text-destructive">Error: {error}</p>}
        {health && (
          <pre className="overflow-x-auto">{JSON.stringify(health, null, 2)}</pre>
        )}
      </div>
    </main>
  );
}

export default App;
