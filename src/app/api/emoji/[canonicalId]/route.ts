import { NextResponse } from "next/server";
import { isMasterR2ApiEnabled } from "@/lib/master/r2/config";
import { decodeCanonicalIdFromApi } from "@/lib/master/r2/keys";
import { jsonResponseHeaders } from "@/lib/master/r2/http";
import { getMasterDataProvider } from "@/lib/master/r2/provider";

export async function GET(
  _request: Request,
  context: { params: Promise<{ canonicalId: string }> },
): Promise<NextResponse> {
  if (!isMasterR2ApiEnabled()) {
    return NextResponse.json({ error: "Master R2 API is disabled" }, { status: 404 });
  }

  const provider = getMasterDataProvider();
  if (!provider) {
    return NextResponse.json({ error: "Master data provider unavailable" }, { status: 503 });
  }

  const { canonicalId: encoded } = await context.params;
  const canonicalId = decodeCanonicalIdFromApi(encoded);
  const identity = await provider.getIdentity(canonicalId);

  if (!identity) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  const artwork = await provider.listArtworkKeysForCanonical(canonicalId);

  return NextResponse.json(
    {
      identity,
      artwork,
    },
    { headers: jsonResponseHeaders() },
  );
}
