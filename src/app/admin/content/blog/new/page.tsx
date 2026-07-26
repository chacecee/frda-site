"use client";

import {
  useEffect,
  useState,
} from "react";
import {
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

export default function NewBlogPostPage() {
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
    !user
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
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{
                borderRadius: 5,
              }}
            >
              ☰
            </button>

            <p className="text-2xl font-semibold text-white">
              New Blog Post
            </p>
          </div>

          <BlogPostEditorForm
            mode="create"
            currentUserEmail={
              user.email || ""
            }
          />
        </section>
      </div>
    </main>
  );
}