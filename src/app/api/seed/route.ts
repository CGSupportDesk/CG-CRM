import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { buildPosterCampaignSeed } from "@/lib/poster-campaign";
import { createSeedData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encodedTracker = process.env.GROWTH_ENGINE_SEED_TSV_BASE64;
  if (!encodedTracker) {
    return NextResponse.json(createSeedData(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const trackerTsv = Buffer.from(encodedTracker, "base64").toString("utf8");
    return NextResponse.json(buildPosterCampaignSeed(trackerTsv), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(createSeedData(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
