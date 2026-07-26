import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";
import {
  deleteAdminImage,
  uploadAdminImage,
} from "@/lib/server/adminMedia";

export const runtime = "nodejs";

function reply(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function text(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function bool(
  value: FormDataEntryValue | null,
) {
  return value === "true";
}

function isValidHttpUrl(
  value: string,
) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function serialize(
  value: unknown,
): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>,
      ).map(([key, item]) => [
        key,
        serialize(item),
      ]),
    );
  }

  return value;
}

export async function GET(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_announcements",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const [
    announcementsSnapshot,
    settingsSnapshot,
  ] = await Promise.all([
    adminDb
      .collection("announcements")
      .orderBy("updatedAt", "desc")
      .get(),

    adminDb
      .collection("homepageSettings")
      .doc("homepage")
      .get(),
  ]);

  return reply({
    ok: true,
    announcements:
      announcementsSnapshot.docs.map(
        (document) => ({
          id: document.id,
          ...(
            serialize(
              document.data(),
            ) as Record<string, unknown>
          ),
        }),
      ),
    settings: {
      announcementSectionEnabled:
        settingsSnapshot.exists
          ? settingsSnapshot.data()
              ?.announcementSectionEnabled !==
            false
          : true,
    },
  });
}

export async function POST(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_announcements",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  let uploadedPath = "";

  try {
    const formData =
      await request.formData();

    const id =
      text(formData.get("id"), 128);

    const type =
      text(formData.get("type"), 20);

    const title =
      text(formData.get("title"), 180);

    const description =
      text(
        formData.get("description"),
        5000,
      );

    const ctaLabel =
      text(
        formData.get("ctaLabel"),
        80,
      );

    const ctaLink =
      text(
        formData.get("ctaLink"),
        1000,
      );

    const facebookVideoUrl =
      text(
        formData.get(
          "facebookVideoUrl",
        ),
        1000,
      );

    const isActive =
      bool(formData.get("isActive"));

    const imageEntry =
      formData.get("image");

    const image =
      imageEntry instanceof File &&
      imageEntry.size > 0
        ? imageEntry
        : null;

    if (
      type !== "standard" &&
      type !== "livestream"
    ) {
      return reply(
        {
          ok: false,
          error:
            "Choose a valid announcement type.",
        },
        400,
      );
    }

    if (!title || !description) {
      return reply(
        {
          ok: false,
          error:
            "Title and description are required.",
        },
        400,
      );
    }

    if (
      !isValidHttpUrl(ctaLink) ||
      !isValidHttpUrl(
        facebookVideoUrl,
      )
    ) {
      return reply(
        {
          ok: false,
          error:
            "Announcement links must be valid HTTP or HTTPS URLs.",
        },
        400,
      );
    }

    if (
      type === "livestream" &&
      !facebookVideoUrl
    ) {
      return reply(
        {
          ok: false,
          error:
            "A Facebook video URL is required for livestream announcements.",
        },
        400,
      );
    }

    const reference =
      id
        ? adminDb
            .collection(
              "announcements",
            )
            .doc(id)
        : adminDb
            .collection(
              "announcements",
            )
            .doc();

    const previousSnapshot =
      id
        ? await reference.get()
        : null;

    if (
      id &&
      !previousSnapshot?.exists
    ) {
      return reply(
        {
          ok: false,
          error:
            "The announcement was not found.",
        },
        404,
      );
    }

    const previous =
      previousSnapshot?.data() || {};

    let imageUrl =
      String(previous.imageUrl || "");

    let imagePath =
      String(previous.imagePath || "");

    if (image) {
      const uploaded =
        await uploadAdminImage({
          file: image,
          folder: "announcements",
        });

      imageUrl = uploaded.imageUrl;
      imagePath = uploaded.imagePath;
      uploadedPath = uploaded.imagePath;
    }

    await adminDb.runTransaction(
      async (transaction) => {
        if (isActive) {
          const activeSnapshot =
            await adminDb
              .collection(
                "announcements",
              )
              .where(
                "isActive",
                "==",
                true,
              )
              .get();

          activeSnapshot.docs.forEach(
            (document) => {
              if (
                document.id !==
                reference.id
              ) {
                transaction.update(
                  document.ref,
                  {
                    isActive: false,
                    updatedAt:
                      FieldValue.serverTimestamp(),
                    updatedByUid:
                      authorization.staff.uid,
                    updatedByEmail:
                      authorization.staff
                        .emailAddress,
                  },
                );
              }
            },
          );
        }

        transaction.set(
          reference,
          {
            type,
            title,
            description,
            imageUrl,
            imagePath,
            ctaLabel,
            ctaLink,
            facebookVideoUrl:
              type === "livestream"
                ? facebookVideoUrl
                : "",
            livestreamProvider:
              type === "livestream"
                ? "facebook"
                : "",
            isActive,
            updatedAt:
              FieldValue.serverTimestamp(),
            updatedByUid:
              authorization.staff.uid,
            updatedByEmail:
              authorization.staff
                .emailAddress,
            ...(
              id
                ? {}
                : {
                    createdAt:
                      FieldValue.serverTimestamp(),
                    createdByUid:
                      authorization.staff.uid,
                    createdByEmail:
                      authorization.staff
                        .emailAddress,
                  }
            ),
          },
          { merge: true },
        );
      },
    );

    if (
      image &&
      previous.imagePath &&
      previous.imagePath !== imagePath
    ) {
      await deleteAdminImage(
        String(previous.imagePath),
      ).catch((error) => {
        console.warn(
          "Old announcement image cleanup failed:",
          error,
        );
      });
    }

    uploadedPath = "";

    return reply({
      ok: true,
      id: reference.id,
    });
  } catch (error) {
    if (uploadedPath) {
      await deleteAdminImage(
        uploadedPath,
      ).catch(() => undefined);
    }

    console.error(
      "Announcement save error:",
      error,
    );

    return reply(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save the announcement.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_announcements",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const action =
    typeof body?.action === "string"
      ? body.action.trim()
      : "";

  if (
    action ===
    "set_section_enabled"
  ) {
    const enabled =
      body?.enabled === true;

    await adminDb
      .collection(
        "homepageSettings",
      )
      .doc("homepage")
      .set(
        {
          announcementSectionEnabled:
            enabled,
          updatedAt:
            FieldValue.serverTimestamp(),
          updatedByUid:
            authorization.staff.uid,
          updatedByEmail:
            authorization.staff
              .emailAddress,
        },
        { merge: true },
      );

    return reply({
      ok: true,
    });
  }

  if (
    action === "toggle_active"
  ) {
    const id =
      typeof body?.id === "string"
        ? body.id.trim()
        : "";

    if (!id) {
      return reply(
        {
          ok: false,
          error:
            "The announcement ID is missing.",
        },
        400,
      );
    }

    const reference =
      adminDb
        .collection(
          "announcements",
        )
        .doc(id);

    await adminDb.runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(
            reference,
          );

        if (!snapshot.exists) {
          throw new Error(
            "The announcement was not found.",
          );
        }

        const nextActive =
          snapshot.data()
            ?.isActive !== true;

        if (nextActive) {
          const activeSnapshot =
            await adminDb
              .collection(
                "announcements",
              )
              .where(
                "isActive",
                "==",
                true,
              )
              .get();

          activeSnapshot.docs.forEach(
            (document) => {
              if (
                document.id !== id
              ) {
                transaction.update(
                  document.ref,
                  {
                    isActive: false,
                    updatedAt:
                      FieldValue.serverTimestamp(),
                    updatedByUid:
                      authorization.staff.uid,
                    updatedByEmail:
                      authorization.staff
                        .emailAddress,
                  },
                );
              }
            },
          );
        }

        transaction.update(
          reference,
          {
            isActive: nextActive,
            updatedAt:
              FieldValue.serverTimestamp(),
            updatedByUid:
              authorization.staff.uid,
            updatedByEmail:
              authorization.staff
                .emailAddress,
          },
        );
      },
    );

    return reply({
      ok: true,
    });
  }

  return reply(
    {
      ok: false,
      error:
        "The announcement action is invalid.",
    },
    400,
  );
}

export async function DELETE(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_announcements",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const id =
    new URL(request.url)
      .searchParams
      .get("id")
      ?.trim() || "";

  if (!id) {
    return reply(
      {
        ok: false,
        error:
          "The announcement ID is missing.",
      },
      400,
    );
  }

  const reference =
    adminDb
      .collection(
        "announcements",
      )
      .doc(id);

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    return reply(
      {
        ok: false,
        error:
          "The announcement was not found.",
      },
      404,
    );
  }

  const imagePath =
    String(
      snapshot.data()?.imagePath ||
      "",
    );

  await reference.delete();

  await deleteAdminImage(
    imagePath,
  ).catch((error) => {
    console.warn(
      "Announcement image cleanup failed:",
      error,
    );
  });

  return reply({
    ok: true,
  });
}