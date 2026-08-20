import { NextResponse } from "next/server";
import { ingestAnalyticsEvents } from "@/lib/content/analytics/server-ingest";
import { checkAnalyticsRateLimit, rateLimitKeyFromRequest } from "@/lib/content/analytics/rate-limit";
import { containsPiiFields, isPayloadTooLarge, validateAnalyticsBatch } from "@/lib/content/analytics/validation";
import { jsonResponseHeaders } from "@/lib/master/r2/http";

export async function POST(request: Request): Promise<NextResponse> {
  const rateKey = rateLimitKeyFromRequest(request);
  if (!checkAnalyticsRateLimit(rateKey)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: jsonResponseHeaders() });
  }

  const bodyText = await request.text();
  if (isPayloadTooLarge(bodyText)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: jsonResponseHeaders() });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: jsonResponseHeaders() });
  }

  if (containsPiiFields(body)) {
    return NextResponse.json({ error: "PII fields rejected" }, { status: 403, headers: jsonResponseHeaders() });
  }

  const events = validateAnalyticsBatch(body);
  if (events.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400, headers: jsonResponseHeaders() });
  }

  const ingested = await ingestAnalyticsEvents(events);
  return NextResponse.json({ accepted: ingested }, { status: 202, headers: jsonResponseHeaders() });
}
