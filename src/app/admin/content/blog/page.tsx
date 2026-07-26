"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  signOut,
} from "firebase/auth";
import {
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  auth,
} from "@/lib/firebase";
import {
  useAuthUser,
} from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import {
  setPresenceOffline,
} from "@/lib/usePresence";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category?: string;
  author: string;
  publishDate: string;
  excerpt: string;
  featuredImageUrl?: string;
  featuredImagePath?: string;
  body: string;
  isPublished: boolean;
  showOnHomepage: boolean;
  updatedAt?: string | null;
};

function formatDate(
  value?: string | null,
) {
  if (!value) return "—";

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? "—"
    : date.toLocaleString();
}

export default function BlogAdminPage() {
  const router =
    useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    posts,
    setPosts,
  ] = useState<BlogPost[]>([]);

  const [
    loadingPosts,
    setLoadingPosts,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<BlogPost | null>(
    null,
  );

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace(
        "/admin/login",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  async function loadPosts() {
    if (!user) return;

    setLoadingPosts(true);
    setPageError("");

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/blog",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
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
          "Could not load blog posts.",
        );
      }

      setPosts(
        Array.isArray(
          result.posts,
        )
          ? result.posts
          : [],
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load blog posts.",
      );
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(
        user?.uid,
        user?.email,
      );

      await signOut(auth);

      router.replace(
        "/admin/login",
      );
    } catch (error) {
      console.error(
        "Sign out error:",
        error,
      );
    }
  }

  async function runAction(
    post: BlogPost,
    action:
      | "toggle_published"
      | "toggle_homepage",
  ) {
    if (!user) return;

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/blog",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              id: post.id,
              action,
            }),
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
          "Could not update this blog post.",
        );
      }

      await loadPosts();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update this blog post.",
      );
    }
  }

  async function confirmDeletePost() {
    if (
      !deleteTarget ||
      !user
    ) {
      return;
    }

    setDeletingId(
      deleteTarget.id,
    );

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          `/api/admin/blog?id=${encodeURIComponent(
            deleteTarget.id,
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
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
          "Could not delete this blog post.",
        );
      }

      setDeleteTarget(null);
      await loadPosts();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not delete this blog post.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  const displayName =
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "Unknown User";

  return (
    <>
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="grid min-h-screen lg:grid-cols-[250px_minmax(0,1fr)]">
          <AdminSidebar
            active="content_blog"
            sidebarOpen={
              sidebarOpen
            }
            onCloseSidebar={() =>
              setSidebarOpen(false)
            }
            onNavigate={(path) =>
              router.push(path)
            }
            onSignOut={
              handleSignOut
            }
            displayName={
              displayName
            }
            email={user.email}
          />

          <section className="relative bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">
                  Blog
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Manage articles for the public blog and homepage news section.
                </p>
              </div>

              <Link
                href="/admin/content/blog/new"
                className="inline-flex items-center gap-2 bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                style={{
                  borderRadius: 5,
                }}
              >
                <Plus size={16} />
                New Post
              </Link>
            </div>

            {pageError ? (
              <p className="mt-5 text-sm text-red-400">
                {pageError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {loadingPosts ? (
                <div className="text-sm text-zinc-400">
                  Loading blog posts...
                </div>
              ) : posts.length === 0 ? (
                <div className="text-sm text-zinc-400">
                  No blog posts yet.
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="overflow-hidden"
                  >
                    <div
                      className="overflow-hidden bg-zinc-900"
                      style={{
                        aspectRatio:
                          "16 / 9",
                        borderRadius: 12,
                      }}
                    >
                      {post.featuredImageUrl ? (
                        <img
                          src={
                            post.featuredImageUrl
                          }
                          alt={post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-300">
                          <FileText size={40} />
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-white">
                        {post.title}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-400">
                        By {post.author} ·{" "}
                        {post.publishDate}
                      </p>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">
                        {post.excerpt}
                      </p>

                      <div className="mt-3 text-xs text-zinc-500">
                        Updated{" "}
                        {formatDate(
                          post.updatedAt,
                        )}
                      </div>

                      {post.slug ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm text-blue-300 underline"
                        >
                          <ExternalLink
                            size={14}
                          />
                          Open Public Article
                        </a>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              post,
                              "toggle_published",
                            )
                          }
                          className="border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white"
                          style={{
                            borderRadius: 8,
                          }}
                        >
                          {post.isPublished
                            ? "Unpublish"
                            : "Publish"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              post,
                              "toggle_homepage",
                            )
                          }
                          className="border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white"
                          style={{
                            borderRadius: 8,
                          }}
                        >
                          {post.showOnHomepage
                            ? "Remove from Home"
                            : "Show on Home"}
                        </button>

                        <Link
                          href={`/admin/content/blog/${post.id}/edit`}
                          className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white"
                          style={{
                            borderRadius: 8,
                          }}
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget(
                              post,
                            )
                          }
                          className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
                          style={{
                            borderRadius: 8,
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6"
            style={{
              borderRadius: 10,
            }}
          >
            <h3 className="text-xl font-semibold text-white">
              Delete Blog Post
            </h3>

            <p className="mt-3 text-sm text-zinc-300">
              Delete{" "}
              <strong>
                {deleteTarget.title}
              </strong>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={
                  deletingId ===
                  deleteTarget.id
                }
                className="border border-zinc-600 px-4 py-3 text-sm text-white"
                style={{
                  borderRadius: 5,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmDeletePost
                }
                disabled={
                  deletingId ===
                  deleteTarget.id
                }
                className="bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                style={{
                  borderRadius: 5,
                }}
              >
                {deletingId ===
                deleteTarget.id
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}