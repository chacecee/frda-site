"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  signOut,
} from "firebase/auth";
import {
  auth,
} from "@/lib/firebase";
import {
  useAuthUser,
} from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BlogPostEditorForm from "@/components/admin/BlogPostEditorForm";
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
  publishTime?: string;
  excerpt: string;
  featuredImageUrl?: string;
  featuredImagePath?: string;
  featuredImageCaption?: string;
  body: string;
  isPublished: boolean;
  showOnHomepage: boolean;
};

export default function EditBlogPostPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    post,
    setPost,
  ] = useState<BlogPost | null>(
    null,
  );

  const [
    loadingPost,
    setLoadingPost,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

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

  useEffect(() => {
    if (
      !user ||
      !params?.id
    ) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadPost() {
      setLoadingPost(true);
      setPageError("");

      try {
        const idToken =
          await currentUser
            .getIdToken();

        const response =
          await fetch(
            `/api/admin/blog?id=${encodeURIComponent(
              params.id,
            )}`,
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
            "Could not load this blog post.",
          );
        }

        if (!cancelled) {
          setPost(
            result.post,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load this blog post.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPost(false);
        }
      }
    }

    loadPost();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    params?.id,
  ]);

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

  if (
    authLoading ||
    !user ||
    loadingPost
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">
            Loading editor...
          </p>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-red-400">
            {pageError ||
              "That blog post could not be found."}
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

        <section className="bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
          <BlogPostEditorForm
            mode="edit"
            initialPost={post}
            currentUserEmail={
              user.email || ""
            }
          />
        </section>
      </div>
    </main>
  );
}