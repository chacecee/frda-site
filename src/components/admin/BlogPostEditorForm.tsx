"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeString() {
  const now = new Date();
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function BlogPostEditorForm({
  mode,
  initialPost,
  currentUserEmail,
}: BlogPostEditorFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    title: initialPost?.title || "",
    slug: initialPost?.slug || "",
    category: initialPost?.category || "",
    author: initialPost?.author || "",
    publishDate: initialPost?.publishDate || getTodayDateString(),
    publishTime: initialPost?.publishTime || getCurrentTimeString(),
    excerpt: initialPost?.excerpt || "",
    featuredImageCaption: initialPost?.featuredImageCaption || "",
    body: initialPost?.body || "",
    isPublished: initialPost?.isPublished ?? true,
    showOnHomepage: initialPost?.showOnHomepage ?? false,
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialPost?.slug);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageInputKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;

    if (selectedImageFile) {
      objectUrl = URL.createObjectURL(selectedImageFile);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl("");
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  useEffect(() => {
    if (slugManuallyEdited) return;

    setForm((prev) => ({
      ...prev,
      slug: slugify(prev.title),
    }));
  }, [form.title, slugManuallyEdited]);

  const pageTitle = useMemo(() => {
    return mode === "create" ? "Create Blog Post" : "Edit Blog Post";
  }, [mode]);

  async function uploadBlogImage(file: File) {
    const extension = file.name.split(".").pop() || "jpg";
    const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const imagePath = `blog/${safeBase}.${extension}`;
    const storageRef = ref(storage, imagePath);

    return await new Promise<{ imagePath: string; imageUrl: string }>(
      (resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type || "image/png",
        });

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => reject(error),
          async () => {
            try {
              const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ imagePath, imageUrl });
            } catch (error) {
              reject(error);
            }
          }
        );
      }
    );
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const title = form.title.trim();
    const slug = slugify(form.slug);
    const category = form.category.trim();
    const author = form.author.trim();
    const publishDate = form.publishDate.trim();
    const publishTime = form.publishTime.trim();
    const excerpt = form.excerpt.trim();
    const featuredImageCaption = form.featuredImageCaption.trim();
    const body = form.body.trim();

    if (!title) {
      setFormError("Title is required.");
      return;
    }

    if (!slug) {
      setFormError("Slug is required.");
      return;
    }

    if (!author) {
      setFormError("Author is required.");
      return;
    }

    if (!publishDate) {
      setFormError("Publish Date is required.");
      return;
    }

    if (!publishTime) {
      setFormError("Publish Time is required.");
      return;
    }

    if (!excerpt) {
      setFormError("Excerpt is required.");
      return;
    }

    if (!body) {
      setFormError("Article body is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    setUploadProgress(0);

    try {
      let featuredImageUrl = initialPost?.featuredImageUrl || "";
      let featuredImagePath = initialPost?.featuredImagePath || "";

      if (selectedImageFile) {
        const uploaded = await uploadBlogImage(selectedImageFile);
        featuredImageUrl = uploaded.imageUrl;
        featuredImagePath = uploaded.imagePath;

        if (initialPost?.featuredImagePath) {
          try {
            await deleteObject(ref(storage, initialPost.featuredImagePath));
          } catch (error) {
            console.warn("Old blog image could not be deleted:", error);
          }
        }
      }

      const payload = {
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
        isPublished: form.isPublished,
        showOnHomepage: form.showOnHomepage,
        updatedAt: serverTimestamp(),
        updatedByEmail: currentUserEmail,
      };

      if (mode === "edit" && initialPost?.id) {
        await updateDoc(doc(db, "blogPosts", initialPost.id), payload);
      } else {
        await addDoc(collection(db, "blogPosts"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByEmail: currentUserEmail,
        });
      }

      router.push("/admin/content/blog");
    } catch (error) {
      console.error("Error saving blog post:", error);
      setFormError("Could not save this blog post. Please try again.");
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                style={{ borderRadius: 5 }}
                placeholder="Enter the article title"
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
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                style={{ borderRadius: 5 }}
                placeholder="article-slug"
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                style={{ borderRadius: 5 }}
                placeholder="News"
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, author: e.target.value }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                style={{ borderRadius: 5 }}
                placeholder="FRDA"
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, publishDate: e.target.value }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{ borderRadius: 5 }}
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, publishTime: e.target.value }))
                }
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                style={{ borderRadius: 5 }}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Excerpt
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, excerpt: e.target.value }))
                }
                rows={4}
                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                style={{ borderRadius: 5 }}
                placeholder="Write a short summary for cards and previews"
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
                  style={{ width: 180, height: 112, borderRadius: 8 }}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="New preview"
                      className="h-full w-full object-cover"
                    />
                  ) : initialPost?.featuredImageUrl ? (
                    <img
                      src={initialPost.featuredImageUrl}
                      alt={initialPost.title}
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
                    Optional. The file will only upload after you press Save.
                  </p>

                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    Recommended image size: 1600 × 900 px, or any 16:9 image. JPG, PNG, or WebP under 5 MB works best.
                  </p>

                  {selectedImageFile ? (
                    <p className="mt-2 text-xs text-blue-300">
                      Selected — {selectedImageFile.name}
                    </p>
                  ) : initialPost?.featuredImageUrl ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Keeping current image unless you choose a new one.
                    </p>
                  ) : null}
                </div>
              </div>

              <input
                key={imageInputKey}
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setSelectedImageFile(e.target.files?.[0] || null)
                }
                className="block w-full text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
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
                  setForm((prev) => ({
                    ...prev,
                    body: value,
                  }))
                }
                placeholder="Write the article body here. Highlight text and use the toolbar for bold, italic, underline, links, lists, and quotes."
              />

              <p className="mt-2 text-xs leading-6 text-zinc-500">
                Use the toolbar to format text. You can add bold, italic, underline, links,
                bullet lists, numbered lists, quotes, and headings.
              </p>
            </div>


            <div className="md:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isPublished: e.target.checked,
                    }))
                  }
                  disabled={saving}
                />
                Publish this post
              </label>

              <label className="flex items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={form.showOnHomepage}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      showOnHomepage: e.target.checked,
                    }))
                  }
                  disabled={saving}
                />
                Show this post on homepage
              </label>
            </div>
          </div>

          {saving ? (
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-blue-100">
                  {selectedImageFile ? "Uploading image..." : "Saving blog post..."}
                </p>
                <span className="text-xs text-blue-200">
                  {selectedImageFile ? `${Math.round(uploadProgress)}%` : ""}
                </span>
              </div>

              {selectedImageFile ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Please wait...</span>
                </div>
              )}
            </div>
          ) : null}

          {formError ? <p className="text-sm text-red-400">{formError}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/admin/content/blog")}
              className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                borderRadius: 5,
                background: "transparent",
                border: "1px solid rgba(113, 113, 122, 0.45)",
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                borderRadius: 5,
                background:
                  "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                border: "1px solid rgba(96, 165, 250, 0.55)",
                boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                minWidth: 130,
              }}
            >
              {saving ? "Saving..." : mode === "create" ? "Create Post" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}