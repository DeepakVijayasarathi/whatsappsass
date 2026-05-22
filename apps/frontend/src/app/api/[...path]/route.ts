import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:4000";

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  const search = request.nextUrl.search;
  const url = `${BACKEND}/${path}${search}`;

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

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const resHeaders = new Headers();
    res.headers.forEach((v, k) => {
      if (!["transfer-encoding", "connection"].includes(k.toLowerCase())) {
        resHeaders.set(k, v);
      }
    });

    const resBody = await res.arrayBuffer();
    return new NextResponse(resBody, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (err) {
    console.error("[api-proxy] upstream error", url, err);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
