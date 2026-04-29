"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { Pencil, Trash2, ExternalLink, FileText, Plus } from "lucide-react";
import { auth, db, storage } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import {
  SidebarPermissionMap,
  canManageBlog,
} from "@/lib/adminPermissions";

type StaffProfile = {
  id: string;
  emailAddress?: string;
  role?: string;
};

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
  featuredImageCaption?: string;
  body: string;
  isPublished: boolean;
  showOnHomepage: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdByEmail?: string;
  updatedByEmail?: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function formatDate(timestamp?: Timestamp) {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleString();
}

function formatPublishDate(value?: string) {
  if (!value) return "—";
  return value;
}

export default function BlogAdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [permissionMap, setPermissionMap] = useState<SidebarPermissionMap>({});
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [pageError, setPageError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      setPageError("");

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

  useEffect(() => {
    const permissionsRef = doc(db, "adminUiPermissions", "sidebar");

    const unsubscribe = onSnapshot(
      permissionsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPermissionMap({});
          setPermissionsLoading(false);
          return;
        }

        setPermissionMap(snapshot.data() as SidebarPermissionMap);
        setPermissionsLoading(false);
      },
      (error) => {
        console.error("Error loading blog permissions:", error);
        setPageError("Could not verify your page permissions.");
        setPermissionMap({});
        setPermissionsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const hasAccess = useMemo(() => {
    return canManageBlog(
      staffProfile?.role,
      staffProfile?.id,
      permissionMap
    );
  }, [staffProfile?.role, staffProfile?.id, permissionMap]);

  useEffect(() => {
    if (!user || !hasAccess) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);
    setPageError("");

    const q = query(collection(db, "blogPosts"), orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: BlogPost[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<BlogPost, "id">),
        }));

        setPosts(rows);
        setLoadingPosts(false);
      },
      (error) => {
        console.error("Error loading blog posts:", error);
        setPageError("Could not load blog posts.");
        setLoadingPosts(false);
      }
    );

    return () => unsubscribe();
  }, [user, hasAccess]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  async function togglePublished(post: BlogPost) {
    try {
      await updateDoc(doc(db, "blogPosts", post.id), {
        isPublished: !post.isPublished,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email || "",
      });
    } catch (error) {
      console.error("Error toggling publish status:", error);
      setPageError("Could not update publish status.");
    }
  }

  async function toggleHomepage(post: BlogPost) {
    try {
      await updateDoc(doc(db, "blogPosts", post.id), {
        showOnHomepage: !post.showOnHomepage,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email || "",
      });
    } catch (error) {
      console.error("Error toggling homepage status:", error);
      setPageError("Could not update homepage status.");
    }
  }

  async function confirmDeletePost() {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);
    setPageError("");

    try {
      if (deleteTarget.featuredImagePath) {
        try {
          await deleteObject(ref(storage, deleteTarget.featuredImagePath));
        } catch (error) {
          console.warn("Blog image could not be deleted:", error);
        }
      }

      await deleteDoc(doc(db, "blogPosts", deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Error deleting blog post:", error);
      setPageError("Could not delete this blog post.");
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || !user || roleLoading || permissionsLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-red-400">
            You do not have permission to access Blog.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
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

          <section className="relative bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
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
                Blog
              </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">Blog</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Manage articles for the public blog and homepage news section.
                </p>
              </div>

              <Link
                href="/admin/content/blog/new"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                style={{
                  borderRadius: 5,
                  background:
                    "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                  border: "1px solid rgba(96, 165, 250, 0.55)",
                  boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                }}
              >
                <Plus size={16} />
                <span>New Post</span>
              </Link>
            </div>

            {pageError ? (
              <p className="mt-5 text-sm text-red-400">{pageError}</p>
            ) : null}

            <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {loadingPosts ? (
                <div className="text-sm text-zinc-400">Loading blog posts...</div>
              ) : posts.length === 0 ? (
                <div className="text-sm text-zinc-400">
                  No blog posts yet. Click “New Post” to create the first one.
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="overflow-hidden rounded-[12px] bg-transparent"
                  >
                    <div
                      className="overflow-hidden bg-zinc-900"
                      style={{ aspectRatio: "16 / 9", borderRadius: 12 }}
                    >
                      {post.featuredImageUrl ? (
                        <img
                          src={post.featuredImageUrl}
                          alt={post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_35%)] text-zinc-300">
                          <div className="text-center">
                            <FileText className="mx-auto mb-3 h-10 w-10 text-blue-300" />
                            <p className="text-sm font-medium">Blog Post</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{post.title}</h3>

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${post.isPublished
                            ? "border border-blue-500/30 bg-blue-500/15 text-blue-200"
                            : "border border-zinc-700 bg-zinc-800 text-zinc-300"
                            }`}
                        >
                          {post.isPublished ? "Published" : "Draft"}
                        </span>

                        {post.showOnHomepage ? (
                          <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                            Homepage
                          </span>
                        ) : null}

                        {post.category ? (
                          <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                            {post.category}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-zinc-400">
                        By {post.author} · {formatPublishDate(post.publishDate)}
                      </p>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">
                        {post.excerpt}
                      </p>

                      <div className="mt-3 text-xs text-zinc-500">
                        Updated {formatDate(post.updatedAt)}
                      </div>

                      {post.slug ? (
                        <div className="mt-3">
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
                          >
                            <ExternalLink size={14} />
                            <span>Open Public Article</span>
                          </a>
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => togglePublished(post)}
                          className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                        >
                          {post.isPublished ? "Unpublish" : "Publish"}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleHomepage(post)}
                          className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                        >
                          {post.showOnHomepage ? "Remove from Home" : "Show on Home"}
                        </button>

                        <Link
                          href={`/admin/content/blog/${post.id}/edit`}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(post)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/15"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
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
            className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <h3 className="text-xl font-semibold text-white">Delete Blog Post</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">{deleteTarget.title}</span>?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  borderRadius: 5,
                  background: "transparent",
                  border: "1px solid rgba(113, 113, 122, 0.45)",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeletePost}
                disabled={deletingId === deleteTarget.id}
                className="cursor-pointer px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  borderRadius: 5,
                  background:
                    "linear-gradient(180deg, rgb(220, 38, 38) 0%, rgb(185, 28, 28) 100%)",
                  border: "1px solid rgba(248, 113, 113, 0.45)",
                  minWidth: 110,
                }}
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}