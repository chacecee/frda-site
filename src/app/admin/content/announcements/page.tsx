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
  ExternalLink,
  Pencil,
  Radio,
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

type Announcement = {
  id: string;
  type:
    | "standard"
    | "livestream";
  title: string;
  description: string;
  imageUrl?: string;
  imagePath?: string;
  ctaLabel?: string;
  ctaLink?: string;
  facebookVideoUrl?: string;
  isActive: boolean;
  updatedAt?: string | null;
};

type FormState = {
  type:
    | "standard"
    | "livestream";
  title: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  facebookVideoUrl: string;
  isActive: boolean;
};

const EMPTY_FORM:
  FormState = {
    type: "standard",
    title: "",
    description: "",
    ctaLabel: "",
    ctaLink: "",
    facebookVideoUrl: "",
    isActive: true,
  };

export default function AnnouncementsAdminPage() {
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
    announcements,
    setAnnouncements,
  ] = useState<
    Announcement[]
  >([]);

  const [
    sectionEnabled,
    setSectionEnabled,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState<
    Announcement | null
  >(null);

  const [form, setForm] =
    useState<FormState>(
      EMPTY_FORM,
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

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<
    Announcement | null
  >(null);

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

  async function loadData() {
    if (!user) return;

    setLoading(true);
    setPageError("");

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/announcements",
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
          "Could not load announcements.",
        );
      }

      setAnnouncements(
        Array.isArray(
          result.announcements,
        )
          ? result.announcements
          : [],
      );

      setSectionEnabled(
        result.settings
          ?.announcementSectionEnabled !==
          false,
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadData();
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

  function openCreateModal() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedImageFile(
      null,
    );
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(
    item: Announcement,
  ) {
    setEditing(item);
    setForm({
      type: item.type,
      title: item.title,
      description:
        item.description,
      ctaLabel:
        item.ctaLabel || "",
      ctaLink:
        item.ctaLink || "",
      facebookVideoUrl:
        item.facebookVideoUrl ||
        "",
      isActive:
        item.isActive,
    });
    setSelectedImageFile(
      null,
    );
    setFormError("");
    setModalOpen(true);
  }

  async function saveAnnouncement(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!user) return;

    setSaving(true);
    setFormError("");

    try {
      const idToken =
        await user.getIdToken();

      const data =
        new FormData();

      if (editing) {
        data.set(
          "id",
          editing.id,
        );
      }

      Object.entries(
        form,
      ).forEach(
        ([key, value]) => {
          data.set(
            key,
            String(value),
          );
        },
      );

      if (selectedImageFile) {
        data.set(
          "image",
          selectedImageFile,
        );
      }

      const response =
        await fetch(
          "/api/admin/announcements",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            body: data,
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
          "Could not save this announcement.",
        );
      }

      setModalOpen(false);
      await loadData();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not save this announcement.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function patch(
    body:
      Record<string, unknown>,
  ) {
    if (!user) return;

    const idToken =
      await user.getIdToken();

    const response =
      await fetch(
        "/api/admin/announcements",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify(
            body,
          ),
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
        "Could not update announcements.",
      );
    }
  }

  async function toggleSection(
    enabled: boolean,
  ) {
    try {
      await patch({
        action:
          "set_section_enabled",
        enabled,
      });

      setSectionEnabled(
        enabled,
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update the homepage setting.",
      );
    }
  }

  async function toggleActive(
    item: Announcement,
  ) {
    try {
      await patch({
        action:
          "toggle_active",
        id: item.id,
      });

      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update this announcement.",
      );
    }
  }

  async function deleteAnnouncement() {
    if (
      !deleteTarget ||
      !user
    ) {
      return;
    }

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          `/api/admin/announcements?id=${encodeURIComponent(
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
          "Could not delete this announcement.",
        );
      }

      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not delete this announcement.",
      );
    }
  }

  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="px-6 py-10 text-sm text-zinc-400">
          Loading dashboard...
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
            active="content_announcements"
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-white">
                  Announcements
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Manage the homepage announcement section.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                style={{
                  borderRadius: 5,
                }}
              >
                Add Announcement
              </button>
            </div>

            <div className="mt-6 border border-zinc-800 bg-zinc-950/35 p-4">
              <label className="flex items-center justify-between gap-4 text-sm text-white">
                Homepage Announcement Section
                <input
                  type="checkbox"
                  checked={
                    sectionEnabled
                  }
                  onChange={(event) =>
                    toggleSection(
                      event.target
                        .checked,
                    )
                  }
                />
              </label>
            </div>

            {pageError ? (
              <p className="mt-5 text-sm text-red-400">
                {pageError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {loading ? (
                <p className="text-sm text-zinc-400">
                  Loading announcements...
                </p>
              ) : announcements.length ===
                0 ? (
                <p className="text-sm text-zinc-400">
                  No announcements yet.
                </p>
              ) : (
                announcements.map(
                  (item) => (
                    <div
                      key={item.id}
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
                        {item.imageUrl ? (
                          <img
                            src={
                              item.imageUrl
                            }
                            alt={
                              item.title
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-400">
                            <Radio
                              size={40}
                            />
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-white">
                          {item.title}
                        </h3>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">
                          {item.description}
                        </p>

                        {item.ctaLink ? (
                          <a
                            href={
                              item.ctaLink
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-sm text-blue-300 underline"
                          >
                            <ExternalLink
                              size={14}
                            />
                            {item.ctaLabel ||
                              "Open Link"}
                          </a>
                        ) : null}

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleActive(
                                item,
                              )
                            }
                            className="border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white"
                            style={{
                              borderRadius: 8,
                            }}
                          >
                            {item.isActive
                              ? "Deactivate"
                              : "Set Active"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                item,
                              )
                            }
                            className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white"
                            style={{
                              borderRadius: 8,
                            }}
                          >
                            <Pencil
                              size={14}
                            />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget(
                                item,
                              )
                            }
                            className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
                            style={{
                              borderRadius: 8,
                            }}
                          >
                            <Trash2
                              size={14}
                            />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </section>
        </div>
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-2xl border border-zinc-800 bg-zinc-900 p-6"
            style={{
              borderRadius: 10,
            }}
          >
            <h2 className="text-2xl font-semibold text-white">
              {editing
                ? "Edit Announcement"
                : "Add Announcement"}
            </h2>

            <form
              onSubmit={
                saveAnnouncement
              }
              className="mt-6 grid gap-5"
            >
              <select
                value={form.type}
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      type:
                        event.target
                          .value as
                          | "standard"
                          | "livestream",
                    }),
                  )
                }
                className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
              >
                <option value="standard">
                  Standard
                </option>
                <option value="livestream">
                  Livestream
                </option>
              </select>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      title:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Title"
                className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
              />

              <textarea
                value={
                  form.description
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      description:
                        event.target
                          .value,
                    }),
                  )
                }
                rows={5}
                placeholder="Description"
                className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
              />

              {form.type ===
              "standard" ? (
                <>
                  <input
                    type="text"
                    value={
                      form.ctaLabel
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          previous,
                        ) => ({
                          ...previous,
                          ctaLabel:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="CTA Label"
                    className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                  />

                  <input
                    type="url"
                    value={
                      form.ctaLink
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          previous,
                        ) => ({
                          ...previous,
                          ctaLink:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="CTA Link"
                    className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                  />
                </>
              ) : (
                <input
                  type="url"
                  value={
                    form.facebookVideoUrl
                  }
                  onChange={(event) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        facebookVideoUrl:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Facebook Video URL"
                  className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                />
              )}

              <div>
                {(previewUrl ||
                  editing?.imageUrl) ? (
                  <img
                    src={
                      previewUrl ||
                      editing
                        ?.imageUrl
                    }
                    alt="Preview"
                    className="mb-3 h-32 w-52 object-cover"
                  />
                ) : null}

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
                  className="text-sm text-zinc-300"
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={
                    form.isActive
                  }
                  onChange={(event) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        isActive:
                          event.target
                            .checked,
                      }),
                    )
                  }
                />
                Set active
              </label>

              {formError ? (
                <p className="text-sm text-red-400">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(false)
                  }
                  className="border border-zinc-600 px-4 py-3 text-sm text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {saving
                    ? "Saving..."
                    : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-xl font-semibold text-white">
              Delete Announcement
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
                className="border border-zinc-600 px-4 py-3 text-sm text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  deleteAnnouncement
                }
                className="bg-red-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}