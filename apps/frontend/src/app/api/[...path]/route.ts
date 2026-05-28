import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:4000";

// 30-second proxy timeout — matches the frontend axios timeout (30_000ms).
// SSE streams (/inbox/stream) need a much longer or no timeout, so we exempt them.
const DEFAULT_TIMEOUT_MS = 30_000;
const SSE_PATHS = ["/whatsapp/inbox/stream"];

// 10 MB response body cap to prevent memory exhaustion from pathological responses.
// Legitimate responses (JSON, CSV exports) are well under this limit.
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = "/" + params.path.join("/");
  const search = request.nextUrl.search;
  const url = `${BACKEND}${path}${search}`;

  const headers = new Headers();
  request.headers.forEach((v, k) => {
    if (!["host", "connection", "transfer-encoding"].includes(k.toLowerCase())) {
      headers.set(k, v);
    }
  });

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.text();
  }

  const isSSE = SSE_PATHS.some((p) => path === p);

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body,
      // No signal for SSE — connection is kept alive intentionally
      signal: isSSE ? undefined : AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const resHeaders = new Headers();
    res.headers.forEach((v, k) => {
      if (!["transfer-encoding", "connection"].includes(k.toLowerCase())) {
        resHeaders.set(k, v);
      }
    });

    // SSE streams are forwarded directly without buffering
    if (isSSE && res.body) {
      return new NextResponse(res.body, { status: res.status, headers: resHeaders });
    }

    // For regular responses, cap the body size to prevent memory exhaustion
    const resBuffer = await res.arrayBuffer();
    if (resBuffer.byteLength > MAX_RESPONSE_BYTES) {
      console.error("[api-proxy] Response too large:", resBuffer.byteLength, "bytes from", url);
      return NextResponse.json({ error: "Response too large" }, { status: 502 });
    }

    return new NextResponse(resBuffer, { status: res.status, headers: resHeaders });
  } catch (err: unknown) {
    const isTimeout = (err as { name?: string })?.name === "TimeoutError" ||
                      (err as { code?: string })?.code === "UND_ERR_CONNECT_TIMEOUT";
    console.error("[api-proxy] upstream error", url, err);
    if (isTimeout) {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export const GET    = proxy;
export const POST   = proxy;
export const PUT    = proxy;
export const PATCH  = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
