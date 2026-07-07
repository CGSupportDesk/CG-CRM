import { NextResponse } from "next/server";
import { SESSION_COOKIE, shouldUseSecureCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 0,
  });

  return response;
}
