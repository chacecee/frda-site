import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Meeting finalization has moved to the protected Admin meeting-poll API.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}