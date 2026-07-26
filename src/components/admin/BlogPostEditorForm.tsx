"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  auth,
} from "@/lib/firebase";
import RichTextEditor from "@/components/admin/RichTextEditor";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category?: string;
  author: string;
  publishDate: string;
  publishTime?: string;
  excerpt: string;
  featuredImageUrl?: string;
  featuredImagePath?: string;
  featuredImageCaption?: string;
  body: string;
  isPublished: boolean;
  showOnHomepage: boolean;
};

type BlogPostEditorFormProps = {
  mode: "create" | "edit";
  initialPost?: BlogPost | null;
  currentUserEmail: string;
};

type FormState = {
  title: string;
  slug: string;
  category: string;
  author: string;
  publishDate: string;
  publishTime: string;
  excerpt: string;
  featuredImageCaption: string;
  body: string;
  isPublished: boolean;
  showOnHomepage: boolean;
};

function slugify(
  value: string,
) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTodayDateString() {
  const now = new Date();

  return [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(
      2,
      "0",
    ),
    `${now.getDate()}`.padStart(
      2,
      "0",
    ),
  ].join("-");
}

function getCurrentTimeString() {
  const now = new Date();

  return [
    `${now.getHours()}`.padStart(
      2,
      "0",
    ),
    `${now.getMinutes()}`.padStart(
      2,
      "0",
    ),
  ].join(":");
}

export default function BlogPostEditorForm({
  mode,
  initialPost,
}: BlogPostEditorFormProps) {
  const router =
    useRouter();

  const [form, setForm] =
    useState<FormState>({
      title:
        initialPost?.title || "",
      slug:
        initialPost?.slug || "",
      category:
        initialPost?.category || "",
      author:
        initialPost?.author || "",
      publishDate:
        initialPost?.publishDate ||
        getTodayDateString(),
      publishTime:
        initialPost?.publishTime ||
        getCurrentTimeString(),
      excerpt:
        initialPost?.excerpt || "",
      featuredImageCaption:
        initialPost
          ?.featuredImageCaption ||
        "",
      body:
        initialPost?.body || "",
      isPublished:
        initialPost
          ?.isPublished ??
        true,
      showOnHomepage:
        initialPost
          ?.showOnHomepage ??
        false,
    });

  const [
    slugManuallyEdited,
    setSlugManuallyEdited,
  ] = useState(
    Boolean(
      initialPost?.slug,
    ),
  );

  const [
    selectedImageFile,
    setSelectedImageFile,
  ] = useState<File | null>(
    null,
  );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl =
      URL.createObjectURL(
        selectedImageFile,
      );

    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(
        objectUrl,
      );
    };
  }, [selectedImageFile]);

  useEffect(() => {
    if (slugManuallyEdited) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      slug: slugify(
        previous.title,
      ),
    }));
  }, [
    form.title,
    slugManuallyEdited,
  ]);

  const pageTitle =
    useMemo(
      () =>
        mode === "create"
          ? "Create Blog Post"
          : "Edit Blog Post",
      [mode],
    );

  async function handleSave(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setFormError(
        "Your session has expired. Please sign in again.",
      );
      return;
    }

    const title =
      form.title.trim();

    const slug =
      slugify(form.slug);

    const author =
      form.author.trim();

    const publishDate =
      form.publishDate.trim();

    const publishTime =
      form.publishTime.trim();

    const excerpt =
      form.excerpt.trim();

    const body =
      form.body.trim();

    if (
      !title ||
      !slug ||
      !author ||
      !publishDate ||
      !publishTime ||
      !excerpt ||
      !body
    ) {
      setFormError(
        "Complete all required blog fields.",
      );
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const idToken =
        await currentUser
          .getIdToken();

      const formData =
        new FormData();

      if (
        mode === "edit" &&
        initialPost?.id
      ) {
        formData.set(
          "id",
          initialPost.id,
        );
      }

      formData.set(
        "title",
        title,
      );
      formData.set(
        "slug",
        slug,
      );
      formData.set(
        "category",
        form.category.trim(),
      );
      formData.set(
        "author",
        author,
      );
      formData.set(
        "publishDate",
        publishDate,
      );
      formData.set(
        "publishTime",
        publishTime,
      );
      formData.set(
        "excerpt",
        excerpt,
      );
      formData.set(
        "featuredImageCaption",
        form.featuredImageCaption.trim(),
      );
      formData.set(
        "body",
        body,
      );
      formData.set(
        "isPublished",
        String(
          form.isPublished,
        ),
      );
      formData.set(
        "showOnHomepage",
        String(
          form.showOnHomepage,
        ),
      );

      if (selectedImageFile) {
        formData.set(
          "image",
          selectedImageFile,
        );
      }

      const response =
        await fetch(
          "/api/admin/blog",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            body: formData,
          },
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
          "Could not save this blog post.",
        );
      }

      router.push(
        "/admin/content/blog",
      );
      router.refresh();
    } catch (error) {
      console.error(
        "Error saving blog post:",
        error,
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Could not save this blog post.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Write and manage blog content for the public site.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    title:
                      event.target.value,
                  }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Slug
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(event) => {
                  setSlugManuallyEdited(
                    true,
                  );
                  setForm(
                    (previous) => ({
                      ...previous,
                      slug:
                        event.target
                          .value,
                    }),
                  );
                }}
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Category (Optional)
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    category:
                      event.target.value,
                  }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Author
              </label>
              <input
                type="text"
                value={form.author}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    author:
                      event.target.value,
                  }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Publish Date
              </label>
              <input
                type="date"
                value={form.publishDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    publishDate:
                      event.target.value,
                  }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Publish Time
              </label>
              <input
                type="time"
                value={form.publishTime}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    publishTime:
                      event.target.value,
                  }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Excerpt
              </label>
              <textarea
                value={form.excerpt}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    excerpt:
                      event.target.value,
                  }))
                }
                rows={4}
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{
                  borderRadius: 5,
                }}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Featured Image (Optional)
              </label>

              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <div
                  className="overflow-hidden border border-zinc-800 bg-zinc-900"
                  style={{
                    width: 180,
                    height: 112,
                    borderRadius: 8,
                  }}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="New preview"
                      className="h-full w-full object-cover"
                    />
                  ) : initialPost?.featuredImageUrl ? (
                    <img
                      src={
                        initialPost.featuredImageUrl
                      }
                      alt={
                        initialPost.title
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                      No image selected
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-xs leading-6 text-zinc-500">
                    Optional. The image is uploaded only when you save.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    JPG, PNG, WebP, or GIF under 5 MB.
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) =>
                  setSelectedImageFile(
                    event.target
                      .files?.[0] ||
                    null,
                  )
                }
                className="block w-full text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Article Body
              </label>

              <RichTextEditor
                value={form.body}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    body: value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={
                    form.isPublished
                  }
                  onChange={(event) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        isPublished:
                          event.target
                            .checked,
                      }),
                    )
                  }
                  disabled={saving}
                />
                Publish this post
              </label>

              <label className="flex items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={
                    form.showOnHomepage
                  }
                  onChange={(event) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        showOnHomepage:
                          event.target
                            .checked,
                      }),
                    )
                  }
                  disabled={saving}
                />
                Show this post on homepage
              </label>
            </div>
          </div>

          {saving ? (
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-100">
              Saving blog post...
            </div>
          ) : null}

          {formError ? (
            <p className="text-sm text-red-400">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin/content/blog",
                )
              }
              className="cursor-pointer border border-zinc-600 px-4 py-3 text-sm font-medium text-white"
              style={{
                borderRadius: 5,
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
              style={{
                borderRadius: 5,
              }}
            >
              {saving
                ? "Saving..."
                : mode === "create"
                  ? "Create Post"
                  : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}