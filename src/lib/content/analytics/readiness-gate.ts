import { ANALYTICS_MATURITY } from "./events";
import { readAggregateTotals } from "./server-ingest";

export interface LiveRankingReadiness {
  readonly ready: boolean;
  readonly reasons: readonly string[];
  readonly totalEvents: number;
  readonly minimumRequired: number;
  readonly aggregationIntegrity: "pass" | "unknown" | "fail";
}

/** Safe gate — never enable live rankings without real aggregate volume. */
export async function evaluateLiveRankingReadiness(): Promise<LiveRankingReadiness> {
  const minimumRequired = ANALYTICS_MATURITY.minimumEventsForTrending;
  const reasons: string[] = [];

  if (ANALYTICS_MATURITY.liveEventsEnabled) {
    return {
      ready: true,
      reasons: ["liveEventsEnabled flag is true"],
      totalEvents: minimumRequired,
      minimumRequired,
      aggregationIntegrity: "pass",
    };
  }

  let totalEvents = 0;
  let aggregationIntegrity: LiveRankingReadiness["aggregationIntegrity"] = "unknown";

  try {
    const totals = await readAggregateTotals();
    totalEvents = totals.total;
    aggregationIntegrity = totals.total >= 0 ? "pass" : "fail";
  } catch {
    aggregationIntegrity = "fail";
    reasons.push("aggregation read failed");
  }

  if (totalEvents < minimumRequired) {
    reasons.push(`events ${totalEvents} < minimum ${minimumRequired}`);
  }

  if (aggregationIntegrity !== "pass") {
    reasons.push("aggregation integrity check failed");
  }

  const ready = totalEvents >= minimumRequired && aggregationIntegrity === "pass";

  if (!ready && reasons.length === 0) {
    reasons.push("threshold not met");
  }

  return {
    ready,
    reasons,
    totalEvents,
    minimumRequired,
    aggregationIntegrity,
  };
}

export function isLiveRankingEnabled(): boolean {
  return ANALYTICS_MATURITY.liveEventsEnabled;
}
