import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  agentQuery,
  fetchSimilar,
  fetchUserContext,
  formatAgentTiming,
  refreshContext,
  simulateSpike,
  type UserContextDocument,
} from "@/lib/api";

function Badge({ source }: { source: string }) {
  const colors =
    source === "FACT"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : source === "DERIVED"
        ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : "bg-violet-500/10 text-violet-800 dark:text-violet-200";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors}`}>
      {source}
    </span>
  );
}

export function UserContextPage() {
  const { id } = useParams<{ id: string }>();
  const [context, setContext] = useState<UserContextDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null);
  const [agentTimingLabel, setAgentTimingLabel] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<
    Array<{ firstName: string; lastName: string; similarity: number; summary: string }>
  >([]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetchUserContext(id)
      .then((d) => setContext(d.context))
      .catch(() => {
        setContext(null);
        setError("No context yet — click Refresh context");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!id) return null;

  const askAgent = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setAgentLoading(true);
    setAgentError(null);
    setAgentTimingLabel(null);
    agentQuery(q, id)
      .then((r) => {
        setAgentAnswer(r.answer);
        const label = formatAgentTiming(r.timing);
        setAgentTimingLabel(label || null);
      })
      .catch((e) =>
        setAgentError(e instanceof Error ? e.message : "Agent request failed"),
      )
      .finally(() => setAgentLoading(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-muted-foreground text-sm hover:underline">
            ← Users
          </Link>
          <h1 className="text-2xl font-semibold">
            {context
              ? `${context.identity.firstName} ${context.identity.lastName}`
              : "User context"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              refreshContext(id).then((d) => {
                setContext(d.context);
                setError(null);
              })
            }
          >
            Refresh context
          </Button>
          <Button
            size="sm"
            onClick={() =>
              simulateSpike(id).then((d) => setContext(d.context))
            }
          >
            Simulate error spike
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {error && !context && (
        <p className="text-muted-foreground text-sm">{error}</p>
      )}

      {context && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Production maturity", context.usage.maturity.toUpperCase()],
              ["Usage health", context.usage.health.toUpperCase()],
              [
                "Behaviour anomaly",
                context.behaviour.anomalyProbability != null
                  ? `${(context.behaviour.anomalyProbability * 100).toFixed(0)}%`
                  : "—",
              ],
              [
                "Escalation likelihood",
                context.support.escalationProbability != null
                  ? `${(context.support.escalationProbability * 100).toFixed(0)}%`
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 font-medium">Why?</h2>
            <ul className="space-y-2 text-sm">
              {context.evidence.map((e) => (
                <li key={e.text} className="flex items-start gap-2">
                  <Badge source={e.source} />
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 font-medium">Support recommendation</h2>
            <p className="text-sm">{context.support.recommendedAction}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Category: {context.support.category ?? "pending"} · Severity:{" "}
              {context.support.severity ?? "—"} · Jev: {context.semantic.status}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="font-medium">Ask EnSight</h2>
            <p className="text-muted-foreground text-xs">
              Questions use this user&apos;s stored context (facts + Jev judgments).
            </p>
            <textarea
              className="border-input bg-background min-h-[88px] w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="e.g. Why is their API failing? Should we escalate? What is their integration maturity?"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  askAgent(customQuestion);
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={agentLoading || !customQuestion.trim()}
                onClick={() => askAgent(customQuestion)}
              >
                {agentLoading ? "Thinking…" : "Ask"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={agentLoading}
                onClick={() =>
                  askAgent(
                    `What do we know about ${context.identity.firstName}?`,
                  )
                }
              >
                Summarize user
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  fetchSimilar(id).then((r) => setSimilar(r.similar ?? []))
                }
              >
                Find similar contexts
              </Button>
            </div>
            {agentError && (
              <p className="text-destructive text-sm">{agentError}</p>
            )}
            {agentAnswer && (
              <div className="space-y-2">
                {agentTimingLabel && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Response time: {agentTimingLabel}
                  </p>
                )}
                <div className="bg-muted rounded-md border p-3 text-sm whitespace-pre-wrap">
                  {agentAnswer}
                </div>
              </div>
            )}
          </div>

          {similar.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {similar.map((s) => (
                <li key={`${s.firstName}-${s.similarity}`} className="p-3">
                  {s.firstName} {s.lastName} · {(s.similarity * 100).toFixed(0)}% ·{" "}
                  {s.summary}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
