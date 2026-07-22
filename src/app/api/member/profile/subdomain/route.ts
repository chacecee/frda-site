import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "portal",
  "api",
  "mail",
  "email",
  "support",
  "help",
  "contact",
  "about",
  "blog",
  "news",
  "games",
  "game",
  "developers",
  "developer",
  "opportunities",
  "opportunity",
  "member",
  "members",
  "staff",
  "login",
  "register",
  "signup",
  "survey",
  "privacy",
  "terms",
  "status",
  "discord",
  "cdn",
  "assets",
  "static",
  "files",
  "images",
  "media",
  "app",
  "dashboard",
  "account",
  "accounts",
  "billing",
  "payments",
  "security",
  "root",
  "system",
  "localhost",
]);

function normalizeSubdomain(value: unknown): string {
  if (typeof value !== "string") return "";

  return value.trim().toLowerCase();
}

function validateSubdomain(value: string): string {
  if (!value) {
    return "Enter the custom address you want to use.";
  }

  if (value.length < 3 || value.length > 30) {
    return "Your custom address must contain between 3 and 30 characters.";
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "Use lowercase letters, numbers, and hyphens only. It cannot begin or end with a hyphen.";
  }

  if (value.includes("--")) {
    return "Your custom address cannot contain consecutive hyphens.";
  }

  if (RESERVED_SUBDOMAINS.has(value)) {
    return "That address is reserved by FRDA. Please choose another one.";
  }

  return "";
}

function createPublicAddress(subdomain: string): string {
  return subdomain
    ? `https://${subdomain}.frdaph.org`
    : "";
}

export async function GET(request: NextRequest) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include a developer profile.",
        },
        { status: 403 }
      );
    }

    const requestedSubdomain = normalizeSubdomain(
      request.nextUrl.searchParams.get("value")
    );

    if (requestedSubdomain) {
      const validationError =
        validateSubdomain(requestedSubdomain);

      if (validationError) {
        return NextResponse.json({
          ok: true,
          available: false,
          error: validationError,
        });
      }

      const reservationSnapshot = await adminDb
        .collection("developerSubdomains")
        .doc(requestedSubdomain)
        .get();

      const reservation =
        reservationSnapshot.exists
          ? reservationSnapshot.data() || {}
          : null;

      const available =
        !reservation ||
        String(reservation.uid || "") === member.uid;

      return NextResponse.json({
        ok: true,
        available,
        error: available
          ? ""
          : "That custom address is already claimed.",
      });
    }

    const profileSnapshot = await adminDb
      .collection("developerProfiles")
      .doc(member.uid)
      .get();

    const profile = profileSnapshot.exists
      ? profileSnapshot.data() || {}
      : {};

    const customSubdomain = String(
      profile.customSubdomain || ""
    );

    return NextResponse.json({
      ok: true,
      customSubdomain,
      publicAddress:
        createPublicAddress(customSubdomain),
    });
  } catch (error) {
    console.error(
      "Load developer subdomain error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your custom profile address.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include a developer profile.",
        },
        { status: 403 }
      );
    }

    const body = (await request
      .json()
      .catch(() => null)) as
      | {
          customSubdomain?: unknown;
        }
      | null;

    const customSubdomain = normalizeSubdomain(
      body?.customSubdomain
    );

    const validationError =
      validateSubdomain(customSubdomain);

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
        { status: 400 }
      );
    }

    const profileReference = adminDb
      .collection("developerProfiles")
      .doc(member.uid);

    const memberReference = adminDb
      .collection("members")
      .doc(member.memberId);

    const newReservationReference = adminDb
      .collection("developerSubdomains")
      .doc(customSubdomain);

    await adminDb.runTransaction(
      async (transaction) => {
        const profileSnapshot =
          await transaction.get(profileReference);

        if (!profileSnapshot.exists) {
          throw new Error(
            "Create your developer profile before choosing a custom address."
          );
        }

        const profile =
          profileSnapshot.data() || {};

        const previousSubdomain = String(
          profile.customSubdomain || ""
        )
          .trim()
          .toLowerCase();

        const newReservationSnapshot =
          await transaction.get(
            newReservationReference
          );

        if (
          newReservationSnapshot.exists &&
          String(
            newReservationSnapshot.data()?.uid || ""
          ) !== member.uid
        ) {
          throw new Error(
            "That custom address is already claimed."
          );
        }

        let previousReservationReference:
          | FirebaseFirestore.DocumentReference
          | null = null;

        if (
          previousSubdomain &&
          previousSubdomain !== customSubdomain
        ) {
          previousReservationReference = adminDb
            .collection("developerSubdomains")
            .doc(previousSubdomain);

          await transaction.get(
            previousReservationReference
          );
        }

        transaction.set(
          newReservationReference,
          {
            customSubdomain,
            uid: member.uid,
            memberId: member.memberId,
            claimedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(
          profileReference,
          {
            customSubdomain,
            customProfileAddress:
              createPublicAddress(customSubdomain),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(
          memberReference,
          {
            customSubdomain,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (previousReservationReference) {
          transaction.delete(
            previousReservationReference
          );
        }
      }
    );

    return NextResponse.json({
      ok: true,
      customSubdomain,
      publicAddress:
        createPublicAddress(customSubdomain),
      message:
        "Your custom profile address has been reserved.",
    });
  } catch (error) {
    console.error(
      "Save developer subdomain error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not reserve this custom address.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: message.includes(
          "already claimed"
        )
          ? 409
          : message.includes("Create your")
            ? 400
            : 500,
      }
    );
  }
}