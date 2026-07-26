import {
  NextResponse,
} from "next/server";

function retiredResponse() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "The legacy developer application system has been retired.",
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

export async function PATCH() {
  return retiredResponse();
}

export async function PUT() {
  return retiredResponse();
}

export async function DELETE() {
  return retiredResponse();
}