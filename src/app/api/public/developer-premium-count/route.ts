import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { DEVELOPER_PREMIUM_LAUNCH_LIMIT } from "@/lib/server/developerPremiumLaunch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("members")
      .where("developerPremiumGrantType", "==", "launch_lifetime")
      .where("developerPremiumStatus", "==", "qualified")
      .get();

    const claimed = Math.min(snapshot.size, DEVELOPER_PREMIUM_LAUNCH_LIMIT);
    return NextResponse.json({ ok: true, limit: DEVELOPER_PREMIUM_LAUNCH_LIMIT, claimed, remaining: Math.max(0, DEVELOPER_PREMIUM_LAUNCH_LIMIT - claimed) });
  } catch (error) {
    console.error("Load developer premium count error:", error);
    return NextResponse.json({ ok: false, limit: DEVELOPER_PREMIUM_LAUNCH_LIMIT, claimed: 0, remaining: DEVELOPER_PREMIUM_LAUNCH_LIMIT }, { status: 500 });
  }
}