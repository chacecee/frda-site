import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import DOMPurify from "isomorphic-dompurify";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";
import {
  deleteAdminImage,
  uploadAdminImage,
} from "@/lib/server/adminMedia";

export const runtime = "nodejs";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "hr",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
];

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

function clean(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function slugify(
  value: string,
) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function sanitizeBody(
  value: string,
) {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
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
      "content_blog",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const id =
    new URL(request.url)
      .searchParams
      .get("id")
      ?.trim() || "";

  if (id) {
    const snapshot =
      await adminDb
        .collection("blogPosts")
        .doc(id)
        .get();

    if (!snapshot.exists) {
      return reply(
        {
          ok: false,
          error:
            "The blog post was not found.",
        },
        404,
      );
    }

    return reply({
      ok: true,
      post: {
        id: snapshot.id,
        ...(
          serialize(
            snapshot.data(),
          ) as Record<string, unknown>
        ),
      },
    });
  }

  const snapshot =
    await adminDb
      .collection("blogPosts")
      .orderBy(
        "updatedAt",
        "desc",
      )
      .get();

  return reply({
    ok: true,
    posts: snapshot.docs.map(
      (document) => ({
        id: document.id,
        ...(
          serialize(
            document.data(),
          ) as Record<string, unknown>
        ),
      }),
    ),
  });
}

export async function POST(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_blog",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  let uploadedPath = "";

  try {
    const formData =
      await request.formData();

    const id =
      clean(
        formData.get("id"),
        128,
      );

    const title =
      clean(
        formData.get("title"),
        200,
      );

    const slug =
      slugify(
        clean(
          formData.get("slug"),
          200,
        ),
      );

    const category =
      clean(
        formData.get("category"),
        100,
      );

    const author =
      clean(
        formData.get("author"),
        120,
      );

    const publishDate =
      clean(
        formData.get(
          "publishDate",
        ),
        20,
      );

    const publishTime =
      clean(
        formData.get(
          "publishTime",
        ),
        20,
      );

    const excerpt =
      clean(
        formData.get("excerpt"),
        5000,
      );

    const featuredImageCaption =
      clean(
        formData.get(
          "featuredImageCaption",
        ),
        500,
      );

    const rawBody =
      clean(
        formData.get("body"),
        200000,
      );

    const body =
      sanitizeBody(rawBody);

    const isPublished =
      formData.get("isPublished") ===
      "true";

    const showOnHomepage =
      formData.get(
        "showOnHomepage",
      ) === "true";

    const imageEntry =
      formData.get("image");

    const image =
      imageEntry instanceof File &&
      imageEntry.size > 0
        ? imageEntry
        : null;

    if (
      !title ||
      !slug ||
      !author ||
      !publishDate ||
      !publishTime ||
      !excerpt ||
      !body
    ) {
      return reply(
        {
          ok: false,
          error:
            "Complete all required blog fields.",
        },
        400,
      );
    }

    const duplicateSlugSnapshot =
      await adminDb
        .collection("blogPosts")
        .where("slug", "==", slug)
        .limit(2)
        .get();

    const duplicateSlug =
      duplicateSlugSnapshot.docs.some(
        (document) =>
          document.id !== id,
      );

    if (duplicateSlug) {
      return reply(
        {
          ok: false,
          error:
            "That blog slug is already in use.",
        },
        409,
      );
    }

    const reference =
      id
        ? adminDb
            .collection(
              "blogPosts",
            )
            .doc(id)
        : adminDb
            .collection(
              "blogPosts",
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
            "The blog post was not found.",
        },
        404,
      );
    }

    const previous =
      previousSnapshot?.data() || {};

    let featuredImageUrl =
      String(
        previous.featuredImageUrl ||
        "",
      );

    let featuredImagePath =
      String(
        previous.featuredImagePath ||
        "",
      );

    if (image) {
      const uploaded =
        await uploadAdminImage({
          file: image,
          folder: "blog",
        });

      featuredImageUrl =
        uploaded.imageUrl;

      featuredImagePath =
        uploaded.imagePath;

      uploadedPath =
        uploaded.imagePath;
    }

    await reference.set(
      {
        title,
        slug,
        category,
        author,
        publishDate,
        publishTime,
        excerpt,
        featuredImageUrl,
        featuredImagePath,
        featuredImageCaption,
        body,
        isPublished,
        showOnHomepage,
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

    if (
      image &&
      previous.featuredImagePath &&
      previous.featuredImagePath !==
        featuredImagePath
    ) {
      await deleteAdminImage(
        String(
          previous.featuredImagePath,
        ),
      ).catch((error) => {
        console.warn(
          "Old blog image cleanup failed:",
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
      "Blog save error:",
      error,
    );

    return reply(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save the blog post.",
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
      "content_blog",
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const id =
    typeof body?.id === "string"
      ? body.id.trim()
      : "";

  const action =
    typeof body?.action === "string"
      ? body.action.trim()
      : "";

  if (!id) {
    return reply(
      {
        ok: false,
        error:
          "The blog post ID is missing.",
      },
      400,
    );
  }

  const reference =
    adminDb
      .collection("blogPosts")
      .doc(id);

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    return reply(
      {
        ok: false,
        error:
          "The blog post was not found.",
      },
      404,
    );
  }

  const current =
    snapshot.data() || {};

  const updates:
    Record<string, unknown> = {
      updatedAt:
        FieldValue.serverTimestamp(),
      updatedByUid:
        authorization.staff.uid,
      updatedByEmail:
        authorization.staff
          .emailAddress,
    };

  if (
    action ===
    "toggle_published"
  ) {
    updates.isPublished =
      current.isPublished !== true;
  } else if (
    action ===
    "toggle_homepage"
  ) {
    updates.showOnHomepage =
      current.showOnHomepage !== true;
  } else {
    return reply(
      {
        ok: false,
        error:
          "The blog action is invalid.",
      },
      400,
    );
  }

  await reference.update(updates);

  return reply({
    ok: true,
  });
}

export async function DELETE(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      "content_blog",
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
          "The blog post ID is missing.",
      },
      400,
    );
  }

  const reference =
    adminDb
      .collection("blogPosts")
      .doc(id);

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    return reply(
      {
        ok: false,
        error:
          "The blog post was not found.",
      },
      404,
    );
  }

  const imagePath =
    String(
      snapshot.data()
        ?.featuredImagePath || "",
    );

  await reference.delete();

  await deleteAdminImage(
    imagePath,
  ).catch((error) => {
    console.warn(
      "Blog image cleanup failed:",
      error,
    );
  });

  return reply({
    ok: true,
  });
}