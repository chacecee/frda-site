import { NextResponse } from "next/server";

function retiredResponse() {
  return NextResponse.json(
    {
      success: false,
      error:
        "The old FRDA developer application system has been retired. Please create an FRDA member account instead.",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}