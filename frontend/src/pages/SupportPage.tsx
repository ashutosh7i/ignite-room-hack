import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agentQuery, fetchSupportAnalyze, formatAgentTiming, type UserContextDocument } from "@/lib/api";

type AnalyzeResponse = {
  message: string;
  headline: string;
  userA: { userId: string; ticket?: string; context?: UserContextDocument };
  userB: { userId: string; ticket?: string; context?: UserContextDocument };
};

function SupportColumn({
  label,
  userId,
  ticket,
  context,
}: {
  label: string;
  userId: string;
  ticket?: string;
  context?: UserContextDocument;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
      <p className="rounded-md bg-muted p-3 text-sm italic">
        &ldquo;{ticket ?? "My API has stopped working"}&rdquo;
      </p>
      {context ? (
        <>
          <p className="text-sm">
            <strong>Issue:</strong>{" "}
            {context.support.category?.replace(/_/g, " ") ?? "—"}
          </p>
          <p className="text-sm">
            <strong>Impact:</strong> {context.support.severity ?? context.usage.health}
          </p>
          <p className="text-sm">
            <strong>Action:</strong> {context.support.recommendedAction}
          </p>
          <p className="text-sm">
            <strong>Escalate:</strong>{" "}
            {context.support.escalationProbability != null
              ? `${(context.support.escalationProbability * 100).toFixed(0)}%`
              : "—"}
          </p>
          <Link
            to={`/users/${userId}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Full context
          </Link>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Context not loaded</p>
      )}
    </div>
  );
}

export function SupportPage() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null);
  const [agentTimingLabel, setAgentTimingLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupportAnalyze()
      .then((d) => setData(d as AnalyzeResponse))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support intelligence</h1>
        <p className="text-muted-foreground text-sm">
          Same message. Different context.
        </p>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading demo…</p>}

      {data && (
        <>
          <p className="text-center text-lg font-medium">{data.headline}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <SupportColumn
              label="User A · New developer"
              userId={data.userA.userId}
              ticket={data.userA.ticket}
              context={data.userA.context}
            />
            <SupportColumn
              label="User B · Production customer"
              userId={data.userB.userId}
              ticket={data.userB.ticket}
              context={data.userB.context}
            />
          </div>
          <Button
            onClick={() =>
              agentQuery(
                "Are other users showing similar behaviour to the production customer?",
              ).then((r) => {
                setAgentAnswer(r.answer);
                setAgentTimingLabel(formatAgentTiming(r.timing) || null);
              })
            }
          >
            Ask: similar users?
          </Button>
          {agentAnswer && (
            <div className="space-y-2">
              {agentTimingLabel && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  Response time: {agentTimingLabel}
                </p>
              )}
              <div className="bg-muted rounded-lg border p-4 text-sm">{agentAnswer}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
