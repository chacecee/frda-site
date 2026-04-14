import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "") || "";
}

function stripFrdaPrefix(value: string) {
  return value.startsWith("FRDA-") ? value.slice(5) : value;
}

function codesMatch(storedCode?: string | null, enteredCode?: string | null) {
  const stored = normalizeCode(storedCode);
  const entered = normalizeCode(enteredCode);

  if (!stored || !entered) return false;
  if (stored === entered) return true;
  if (stripFrdaPrefix(stored) === stripFrdaPrefix(entered)) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const enteredEmail = normalizeEmail(body?.email);
    const enteredCode = body?.verificationCode;

    if (!enteredEmail || !enteredCode) {
      return NextResponse.json(
        { error: "Please enter your email address and verification code." },
        { status: 400 }
      );
    }

    const snapshot = await adminDb.collection("applications").get();

    const match = snapshot.docs.find((docSnap) => {
      const data = docSnap.data() as {
        email?: string;
        verificationCode?: string;
        trackerToken?: string;
      };

      return (
        normalizeEmail(data.email) === enteredEmail &&
        codesMatch(data.verificationCode, enteredCode)
      );
    });

    if (!match) {
      return NextResponse.json(
        {
          error:
            "We couldn't find a matching application. Please check your email address and verification code.",
        },
        { status: 404 }
      );
    }

    const data = match.data() as {
      trackerToken?: string;
    };

    if (!data?.trackerToken) {
      return NextResponse.json(
        {
          error:
            "We found your application, but its tracker link is incomplete. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applicationId: match.id,
      trackerToken: data.trackerToken,
    });
  } catch (error: any) {
    console.error("Track lookup error:", error);
    return NextResponse.json(
      {
        error:
          error?.message || "Something went wrong while looking up your application.",
      },
      { status: 500 }
    );
  }
}