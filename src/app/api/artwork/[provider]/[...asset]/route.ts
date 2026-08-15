import { NextResponse } from "next/server";
import { isMasterR2ApiEnabled } from "@/lib/master/r2/config";
import { R2KeyValidationError } from "@/lib/master/r2/keys";
import { artworkResponseHeaders, toBinaryResponseBody } from "@/lib/master/r2/http";
import {
  isPublicArtworkRequestAllowed,
  parsePublicArtworkApiPath,
  resolvePublicArtworkBinary,
} from "@/lib/r2/artwork-binary-route";
import { getMasterR2Adapter, toPublicMasterError } from "@/lib/r2";

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string; asset: string[] }> },
): Promise<NextResponse> {
  if (!isMasterR2ApiEnabled()) {
    return NextResponse.json({ error: "Master R2 API is disabled" }, { status: 404 });
  }

  const adapter = await getMasterR2Adapter();
  if (!adapter) {
    return NextResponse.json({ error: "Master data provider unavailable" }, { status: 503 });
  }

  const { provider, asset } = await context.params;

  try {
    const parsed = parsePublicArtworkApiPath(provider, asset);
    const publiclyServed = await isPublicArtworkRequestAllowed(adapter, parsed.provider);
    if (!publiclyServed) {
      return NextResponse.json(
        {
          error: "Artwork indexed in master database — public serving unavailable for this provider",
          provider: parsed.provider,
          indexed: true,
          publiclyServed: false,
        },
        { status: 403, headers: artworkResponseHeaders("application/json", false) },
      );
    }

    const resolved = await resolvePublicArtworkBinary(
      adapter,
      parsed.provider,
      parsed.sourceId,
      parsed.format,
    );
    if (!resolved) {
      return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
    }

    return new NextResponse(toBinaryResponseBody(resolved.bytes), {
      status: 200,
      headers: artworkResponseHeaders(resolved.contentType, true),
    });
  } catch (error) {
    if (error instanceof R2KeyValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const pub = toPublicMasterError(error);
    return NextResponse.json(
      { error: pub.message, code: pub.code },
      { status: pub.code === "NOT_FOUND" ? 404 : 503 },
    );
  }
}
