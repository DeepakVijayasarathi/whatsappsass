import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:4000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  // Reject path traversal attempts
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND}/uploads/${encodeURIComponent(filename)}`, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "File not found" }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }
}
