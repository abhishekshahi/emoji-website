import { NextResponse } from "next/server";
import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { isMasterR2ApiEnabled } from "@/lib/master/r2/config";
import { artworkResponseHeaders, toBinaryResponseBody } from "@/lib/master/r2/http";
import {
  getMasterR2Adapter,
  isArtworkPubliclyServable,
} from "@/lib/r2";

export async function GET(
  request: Request,
): Promise<NextResponse> {
  if (!isMasterR2ApiEnabled()) {
    return NextResponse.json({ error: "Master R2 API is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const checksum = url.searchParams.get("checksum");
  const provider = url.searchParams.get("provider") as ArtworkProvider | null;
  const ext = (url.searchParams.get("ext") ?? "svg") as "svg" | "png" | "bin";

  if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) {
    return NextResponse.json({ error: "Invalid checksum" }, { status: 400 });
  }

  if (!provider || !["openmoji", "noto", "twemoji", "fluent"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const adapter = await getMasterR2Adapter();
  if (!adapter) {
    return NextResponse.json({ error: "Master data unavailable" }, { status: 503 });
  }

  const matrix = await adapter.getLicenseMatrix();
  if (!isArtworkPubliclyServable(provider, matrix)) {
    return NextResponse.json(
      { error: "Artwork is stored privately for this provider", publiclyServed: false },
      { status: 403, headers: artworkResponseHeaders("application/json", false) },
    );
  }

  const bytes = await adapter.getArtworkBinary(checksum, ext);
  if (!bytes) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  const contentType = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "application/octet-stream";

  return new NextResponse(toBinaryResponseBody(bytes), {
    status: 200,
    headers: artworkResponseHeaders(contentType, true),
  });
}
