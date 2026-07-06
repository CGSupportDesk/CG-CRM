import { NextResponse } from "next/server";
import {
  getConfiguredPassword,
  getConfiguredUsername,
  getSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password || "";
  const configuredPassword = getConfiguredPassword();

  if (!configuredPassword) {
    return NextResponse.json(
      { ok: false, error: "Growth Engine password is not configured." },
      { status: 503 },
    );
  }

  if (username !== getConfiguredUsername() || password !== configuredPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, getSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
