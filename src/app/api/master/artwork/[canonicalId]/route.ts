import { NextResponse } from "next/server";
import { isPublicMasterApiEnabled } from "@/lib/master/public/config";
import { buildPublicArtworkResponse } from "@/lib/master/public/identity-service";
import { shouldReadFromR2Binding } from "@/lib/master/r2/config";
import { jsonResponseHeaders } from "@/lib/master/r2/http";
import { buildPublicArtworkResponseFromR2 } from "@/lib/master/public/r2-service";
import { toPublicMasterError } from "@/lib/r2";

export async function GET(
  _request: Request,
  context: { params: Promise<{ canonicalId: string }> },
): Promise<NextResponse> {
  if (!isPublicMasterApiEnabled()) {
    return NextResponse.json({ error: "Public master API is disabled" }, { status: 404 });
  }

  const { canonicalId: encoded } = await context.params;
  const canonicalId = decodeURIComponent(encoded);

  try {
    const artwork = shouldReadFromR2Binding()
      ? await buildPublicArtworkResponseFromR2(canonicalId)
      : buildPublicArtworkResponse(canonicalId);

    if (!artwork) {
      return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
    }

    return NextResponse.json(artwork, { headers: jsonResponseHeaders() });
  } catch (error: unknown) {
    const pub = toPublicMasterError(error);
    return NextResponse.json(
      { error: pub.message, code: pub.code },
      { status: pub.code === "NOT_FOUND" ? 404 : 503, headers: jsonResponseHeaders() },
    );
  }
}
