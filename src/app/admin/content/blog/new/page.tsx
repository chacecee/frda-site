"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BlogPostEditorForm from "@/components/admin/BlogPostEditorForm";
import { setPresenceOffline } from "@/lib/usePresence";
import { canManageBlog } from "@/lib/adminPermissions";

type StaffProfile = {
  id: string;
  emailAddress?: string;
  role?: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

export default function NewBlogPostPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const displayName =
    user?.displayName?.trim() ||
    (user?.email ? user.email.split("@")[0] : "Unknown User");

  const signedInEmail = normalizeEmail(user?.email);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/admin/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      if (!user?.email) {
        if (!isMounted) return;
        setStaffProfile(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

      try {
        const exactQuery = query(
          collection(db, "staff"),
          where("emailAddress", "==", user.email),
          limit(1)
        );

        const exactSnapshot = await getDocs(exactQuery);

        if (!exactSnapshot.empty) {
          const docSnap = exactSnapshot.docs[0];
          if (!isMounted) return;

          setStaffProfile({
            id: docSnap.id,
            ...(docSnap.data() as Omit<StaffProfile, "id">),
          });
          setRoleLoading(false);
          return;
        }

        const lowerQuery = query(
          collection(db, "staff"),
          where("emailAddress", "==", signedInEmail),
          limit(1)
        );

        const lowerSnapshot = await getDocs(lowerQuery);

        if (!lowerSnapshot.empty) {
          const docSnap = lowerSnapshot.docs[0];
          if (!isMounted) return;

          setStaffProfile({
            id: docSnap.id,
            ...(docSnap.data() as Omit<StaffProfile, "id">),
          });
          setRoleLoading(false);
          return;
        }

        const allStaffSnapshot = await getDocs(collection(db, "staff"));
        const match = allStaffSnapshot.docs.find((docSnap) => {
          const data = docSnap.data() as { emailAddress?: string; role?: string };
          return normalizeEmail(data.emailAddress) === signedInEmail;
        });

        if (!isMounted) return;

        if (!match) {
          setStaffProfile(null);
          setRoleLoading(false);
          return;
        }

        setStaffProfile({
          id: match.id,
          ...(match.data() as Omit<StaffProfile, "id">),
        });
        setRoleLoading(false);
      } catch (error) {
        console.error("Error checking blog access:", error);
        if (!isMounted) return;
        setPageError("Could not verify your permissions.");
        setRoleLoading(false);
      }
    }

    loadRole();

    return () => {
      isMounted = false;
    };
  }, [user?.email, signedInEmail]);

  const hasAccess = useMemo(() => {
    return canManageBlog(staffProfile?.role);
  }, [staffProfile?.role]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  if (authLoading || !user || roleLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">Loading editor...</p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-red-400">
            You do not have permission to create blog posts.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[250px_minmax(0,1fr)]">
        <AdminSidebar
          active="content_blog"
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onNavigate={(path) => router.push(path)}
          onSignOut={handleSignOut}
          displayName={displayName}
          email={user.email}
        />

        <section className="bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 5 }}
            >
              ☰
            </button>
            <p className="text-2xl font-semibold leading-none text-white">
              New Blog Post
            </p>
          </div>

          {pageError ? (
            <p className="mb-6 text-sm text-red-400">{pageError}</p>
          ) : null}

          <BlogPostEditorForm
            mode="create"
            currentUserEmail={user.email || ""}
          />
        </section>
      </div>
    </main>
  );
}