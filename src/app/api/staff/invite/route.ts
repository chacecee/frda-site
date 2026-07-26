import {
  NextResponse,
} from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "This staff invitation endpoint has moved.",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}