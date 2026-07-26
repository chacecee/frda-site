import crypto from "crypto";
import { adminStorage } from "@/lib/firebaseAdmin";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateAdminImage(
  file: File,
  maxBytes = 5 * 1024 * 1024,
) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      "Only JPG, PNG, WebP, and GIF images are allowed.",
    );
  }

  if (
    file.size <= 0 ||
    file.size > maxBytes
  ) {
    throw new Error(
      "The image must be smaller than 5 MB.",
    );
  }
}

function extensionForType(
  contentType: string,
) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function uploadAdminImage({
  file,
  folder,
}: {
  file: File;
  folder: string;
}) {
  validateAdminImage(file);

  const token =
    crypto.randomUUID();

  const fileName =
    `${Date.now()}-${crypto.randomUUID()}.${extensionForType(
      file.type,
    )}`;

  const storagePath =
    `${folder}/${fileName}`;

  const bucket =
    adminStorage.bucket();

  const object =
    bucket.file(storagePath);

  const buffer =
    Buffer.from(
      await file.arrayBuffer(),
    );

  await object.save(buffer, {
    resumable: false,
    metadata: {
      contentType: file.type,
      cacheControl:
        "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens:
          token,
      },
    },
  });

  const encodedPath =
    encodeURIComponent(storagePath);

  const imageUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

  return {
    imagePath: storagePath,
    imageUrl,
  };
}

export async function deleteAdminImage(
  storagePath?: string | null,
) {
  const normalizedPath =
    storagePath?.trim() || "";

  if (!normalizedPath) {
    return;
  }

  await adminStorage
    .bucket()
    .file(normalizedPath)
    .delete({
      ignoreNotFound: true,
    });
}