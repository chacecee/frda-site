import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function cleanString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("gameDirectory")
      .where("status", "==", "published")
      .get();

    const games = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          title: cleanString(data.title),
          description: cleanString(data.description),
          robloxUrl: cleanString(data.robloxUrl),
          creatorName: cleanString(data.creatorName),
          creatorType: cleanString(data.creatorType) || "individual",
          genre: cleanString(data.genre) || "other",
          contentMaturity: cleanString(data.contentMaturity) || "not_sure",
          thumbnailUrl: cleanString(data.thumbnailUrl),
          coverImageUrl: cleanString(data.coverImageUrl),
          isSponsored: Boolean(data.isSponsored),
          isHighlighted: Boolean(data.isHighlighted),
          isHiddenFromPublic: Boolean(data.isHiddenFromPublic),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
        };
      })
      .filter((game) => !game.isHiddenFromPublic)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({
      ok: true,
      games,
    });
  } catch (error) {
    console.error("Public game directory error:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load game directory." },
      { status: 500 }
    );
  }
}