"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    Timestamp,
} from "firebase/firestore";
import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytesResumable,
} from "firebase/storage";
import {
    Pencil,
    Trash2,
    ExternalLink,
    Radio,
    Megaphone,
    ImageIcon,
} from "lucide-react";
import { auth, db, storage } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import { canManageAnnouncements } from "@/lib/adminPermissions";

type AnnouncementType = "standard" | "livestream";
type LivestreamProvider = "facebook";

type Announcement = {
    id: string;
    type: AnnouncementType;
    title: string;
    description: string;
    imageUrl?: string;
    imagePath?: string;
    ctaLabel?: string;
    ctaLink?: string;
    facebookVideoUrl?: string;
    livestreamProvider?: LivestreamProvider;
    isActive: boolean;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdByEmail?: string;
    updatedByEmail?: string;
};

type HomepageSettings = {
    announcementSectionEnabled: boolean;
};

type StaffProfile = {
    id: string;
    emailAddress?: string;
    role?: string;
};

type FormState = {
    type: AnnouncementType;
    title: string;
    description: string;
    ctaLabel: string;
    ctaLink: string;
    facebookVideoUrl: string;
    isActive: boolean;
};

const EMPTY_FORM: FormState = {
    type: "standard",
    title: "",
    description: "",
    ctaLabel: "",
    ctaLink: "",
    facebookVideoUrl: "",
    isActive: true,
};

function normalizeEmail(value?: string | null): string {
    return value?.trim().toLowerCase() || "";
}

function formatDate(timestamp?: Timestamp) {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
}

function isValidUrl(value: string) {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export default function AnnouncementsAdminPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

    const [settings, setSettings] = useState<HomepageSettings>({
        announcementSectionEnabled: true,
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [imageInputKey, setImageInputKey] = useState(0);

    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [pageError, setPageError] = useState("");
    const [formError, setFormError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
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
        let objectUrl: string | null = null;

        if (selectedImageFile) {
            objectUrl = URL.createObjectURL(selectedImageFile);
            setPreviewUrl(objectUrl);
        } else {
            setPreviewUrl("");
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedImageFile]);

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
                console.error("Error checking announcements access:", error);
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
        return canManageAnnouncements(staffProfile?.role);
    }, [staffProfile?.role]);

    useEffect(() => {
        if (!user || !hasAccess) {
            setAnnouncements([]);
            setLoadingAnnouncements(false);
            return;
        }

        setLoadingAnnouncements(true);
        setPageError("");

        const q = query(collection(db, "announcements"), orderBy("updatedAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const rows: Announcement[] = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...(docSnap.data() as Omit<Announcement, "id">),
                }));

                setAnnouncements(rows);
                setLoadingAnnouncements(false);
            },
            (error) => {
                console.error("Error loading announcements:", error);
                setPageError("Could not load announcements.");
                setLoadingAnnouncements(false);
            }
        );

        return () => unsubscribe();
    }, [user, hasAccess]);

    useEffect(() => {
        if (!user || !hasAccess) return;

        const settingsRef = doc(db, "homepageSettings", "homepage");

        const unsubscribe = onSnapshot(
            settingsRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setSettings({ announcementSectionEnabled: true });
                    return;
                }

                const data = snapshot.data() as HomepageSettings;
                setSettings({
                    announcementSectionEnabled:
                        typeof data.announcementSectionEnabled === "boolean"
                            ? data.announcementSectionEnabled
                            : true,
                });
            },
            (error) => {
                console.error("Error loading homepage settings:", error);
                setPageError("Could not load homepage settings.");
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

    async function uploadAnnouncementImage(file: File) {
        const extension = file.name.split(".").pop() || "jpg";
        const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const imagePath = `announcements/${safeBase}.${extension}`;
        const storageRef = ref(storage, imagePath);

        return await new Promise<{ imagePath: string; imageUrl: string }>(
            (resolve, reject) => {
                const uploadTask = uploadBytesResumable(storageRef, file);

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

    async function setOnlyOneActive(targetId: string) {
        const currentlyActive = announcements.filter(
            (item) => item.isActive && item.id !== targetId
        );

        await Promise.all(
            currentlyActive.map((item) =>
                updateDoc(doc(db, "announcements", item.id), {
                    isActive: false,
                    updatedAt: serverTimestamp(),
                    updatedByEmail: user?.email || "",
                })
            )
        );
    }

    async function toggleSectionEnabled(nextValue: boolean) {
        setSavingSettings(true);
        setPageError("");

        try {
            await setDoc(
                doc(db, "homepageSettings", "homepage"),
                {
                    announcementSectionEnabled: nextValue,
                    updatedAt: serverTimestamp(),
                    updatedByEmail: user?.email || "",
                },
                { merge: true }
            );
        } catch (error) {
            console.error("Error saving homepage settings:", error);
            setPageError("Could not update the homepage announcement setting.");
        } finally {
            setSavingSettings(false);
        }
    }

    function openCreateModal() {
        setEditingAnnouncement(null);
        setForm(EMPTY_FORM);
        setSelectedImageFile(null);
        setPreviewUrl("");
        setImageInputKey((prev) => prev + 1);
        setFormError("");
        setUploadProgress(0);
        setModalOpen(true);
    }

    function openEditModal(item: Announcement) {
        setEditingAnnouncement(item);
        setForm({
            type: item.type || "standard",
            title: item.title || "",
            description: item.description || "",
            ctaLabel: item.ctaLabel || "",
            ctaLink: item.ctaLink || "",
            facebookVideoUrl: item.facebookVideoUrl || "",
            isActive: !!item.isActive,
        });
        setSelectedImageFile(null);
        setPreviewUrl("");
        setImageInputKey((prev) => prev + 1);
        setFormError("");
        setUploadProgress(0);
        setModalOpen(true);
    }

    function closeModal() {
        if (saving) return;
        setModalOpen(false);
        setEditingAnnouncement(null);
        setForm(EMPTY_FORM);
        setSelectedImageFile(null);
        setPreviewUrl("");
        setImageInputKey((prev) => prev + 1);
        setFormError("");
        setUploadProgress(0);
    }

    async function handleSaveAnnouncement(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!user?.email) return;

        const title = form.title.trim();
        const description = form.description.trim();
        const ctaLabel = form.ctaLabel.trim();
        const ctaLink = form.ctaLink.trim();
        const facebookVideoUrl = form.facebookVideoUrl.trim();

        if (!title) {
            setFormError("Title is required.");
            return;
        }

        if (!description) {
            setFormError("Description is required.");
            return;
        }

        if (ctaLink && !isValidUrl(ctaLink)) {
            setFormError("CTA Link must be a valid full URL.");
            return;
        }

        if (form.type === "livestream") {
            if (!facebookVideoUrl) {
                setFormError("Facebook Video URL is required for livestream announcements.");
                return;
            }

            if (!isValidUrl(facebookVideoUrl)) {
                setFormError("Facebook Video URL must be a valid full URL.");
                return;
            }
        }

        setSaving(true);
        setFormError("");
        setUploadProgress(0);

        try {
            let imageUrl = editingAnnouncement?.imageUrl || "";
            let imagePath = editingAnnouncement?.imagePath || "";

            if (selectedImageFile) {
                const uploaded = await uploadAnnouncementImage(selectedImageFile);
                imageUrl = uploaded.imageUrl;
                imagePath = uploaded.imagePath;

                if (editingAnnouncement?.imagePath) {
                    try {
                        await deleteObject(ref(storage, editingAnnouncement.imagePath));
                    } catch (error) {
                        console.warn("Old announcement image could not be deleted:", error);
                    }
                }
            }

            if (form.isActive) {
                if (editingAnnouncement) {
                    await setOnlyOneActive(editingAnnouncement.id);
                }
            }

            const payload = {
                type: form.type,
                title,
                description,
                imageUrl: form.type === "standard" ? imageUrl : imageUrl || "",
                imagePath: form.type === "standard" ? imagePath : imagePath || "",
                ctaLabel,
                ctaLink,
                facebookVideoUrl: form.type === "livestream" ? facebookVideoUrl : "",
                livestreamProvider: form.type === "livestream" ? "facebook" : "",
                isActive: form.isActive,
                updatedAt: serverTimestamp(),
                updatedByEmail: user.email,
            };

            if (editingAnnouncement) {
                await updateDoc(doc(db, "announcements", editingAnnouncement.id), payload);
            } else {
                if (form.isActive) {
                    await setOnlyOneActive("__new__");
                }

                await addDoc(collection(db, "announcements"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdByEmail: user.email,
                });
            }

            closeModal();
        } catch (error) {
            console.error("Error saving announcement:", error);
            setFormError("Could not save this announcement. Please try again.");
        } finally {
            setSaving(false);
            setUploadProgress(0);
        }
    }

    async function toggleActive(item: Announcement) {
        try {
            if (!item.isActive) {
                await setOnlyOneActive(item.id);
            }

            await updateDoc(doc(db, "announcements", item.id), {
                isActive: !item.isActive,
                updatedAt: serverTimestamp(),
                updatedByEmail: user?.email || "",
            });
        } catch (error) {
            console.error("Error toggling announcement active state:", error);
            setPageError("Could not update active status.");
        }
    }

    async function confirmDeleteAnnouncement() {
        if (!deleteTarget) return;

        setDeletingId(deleteTarget.id);
        setPageError("");

        try {
            if (deleteTarget.imagePath) {
                try {
                    await deleteObject(ref(storage, deleteTarget.imagePath));
                } catch (error) {
                    console.warn("Announcement image could not be deleted:", error);
                }
            }

            await deleteDoc(doc(db, "announcements", deleteTarget.id));
            setDeleteTarget(null);
        } catch (error) {
            console.error("Error deleting announcement:", error);
            setPageError("Could not delete this announcement.");
        } finally {
            setDeletingId(null);
        }
    }

    if (authLoading || !user || roleLoading) {
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
                        You do not have permission to access Announcements.
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
                        active="content_announcements"
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
                                Announcements
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-white">Announcements</h1>
                                <p className="mt-1 text-sm text-zinc-400">
                                    Manage the homepage announcement section and its active content.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="cursor-pointer px-5 py-3 text-sm font-semibold text-white"
                                style={{
                                    borderRadius: 5,
                                    background:
                                        "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                                    border: "1px solid rgba(96, 165, 250, 0.55)",
                                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                                }}
                            >
                                Add Announcement
                            </button>
                        </div>

                        <div
                            className="mt-6 border border-zinc-800 bg-zinc-950/35 p-4"
                            style={{ borderRadius: 12 }}
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        Homepage Announcement Section
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        Turn the announcement section under the hero on or off.
                                    </p>
                                </div>

                                <label className="inline-flex items-center gap-3 text-sm text-white">
                                    <input
                                        type="checkbox"
                                        checked={settings.announcementSectionEnabled}
                                        onChange={(e) => toggleSectionEnabled(e.target.checked)}
                                        disabled={savingSettings}
                                    />
                                    {settings.announcementSectionEnabled ? "Enabled" : "Disabled"}
                                </label>
                            </div>
                        </div>

                        {pageError ? (
                            <p className="mt-5 text-sm text-red-400">{pageError}</p>
                        ) : null}

                        <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                            {loadingAnnouncements ? (
                                <div className="text-sm text-zinc-400">Loading announcements...</div>
                            ) : announcements.length === 0 ? (
                                <div className="text-sm text-zinc-400">
                                    No announcements yet. Click “Add Announcement” to create the first one.
                                </div>
                            ) : (
                                announcements.map((item) => (
                                    <div
                                        key={item.id}
                                        className="overflow-hidden bg-transparent"
                                        style={{ borderRadius: 12 }}
                                    >
                                        <div
                                            className="overflow-hidden bg-zinc-900"
                                            style={{ aspectRatio: "16 / 9", borderRadius: 12 }}
                                        >
                                            {item.imageUrl ? (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : item.type === "livestream" ? (
                                                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_35%)] text-zinc-300">
                                                    <div className="text-center">
                                                        <Radio className="mx-auto mb-3 h-10 w-10 text-blue-300" />
                                                        <p className="text-sm font-medium">Livestream Announcement</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                                                    No image
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-semibold text-white">{item.title}</h3>

                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${item.isActive
                                                        ? "border border-blue-500/30 bg-blue-500/15 text-blue-200"
                                                        : "border border-zinc-700 bg-zinc-800 text-zinc-300"
                                                        }`}
                                                >
                                                    {item.isActive ? "Active" : "Inactive"}
                                                </span>

                                                <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                                                    {item.type === "livestream" ? "Livestream" : "Standard"}
                                                </span>
                                            </div>

                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">
                                                {item.description}
                                            </p>

                                            <div className="mt-3 text-xs text-zinc-500">
                                                Updated {formatDate(item.updatedAt)}
                                            </div>

                                            {item.type === "livestream" && item.facebookVideoUrl ? (
                                                <div className="mt-3">
                                                    <a
                                                        href={item.facebookVideoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span>Open Facebook Video</span>
                                                    </a>
                                                </div>
                                            ) : null}

                                            {item.type === "standard" && item.ctaLink ? (
                                                <div className="mt-3">
                                                    <a
                                                        href={item.ctaLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span>{item.ctaLabel || "Open Link"}</span>
                                                    </a>
                                                </div>
                                            ) : null}

                                            <div className="mt-5 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActive(item)}
                                                    className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                                                >
                                                    {item.isActive ? "Deactivate" : "Set Active"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(item)}
                                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                                                >
                                                    <Pencil size={14} />
                                                    <span>Edit</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(item)}
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

            {modalOpen ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
                    <div
                        className="w-full max-w-2xl border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                        style={{ borderRadius: 10 }}
                    >
                        <div className="border-b border-zinc-800 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-semibold text-white">
                                        {editingAnnouncement ? "Edit Announcement" : "Add Announcement"}
                                    </h2>
                                    <p className="mt-2 text-sm text-zinc-400">
                                        Create a standard announcement or a livestream announcement.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeModal}
                                    aria-label="Close"
                                    className="cursor-pointer text-white hover:text-zinc-300"
                                    style={{
                                        width: 42,
                                        height: 42,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: 5,
                                        border: "1px solid rgba(63, 63, 70, 1)",
                                        background: "rgba(9, 9, 11, 0.9)",
                                        fontSize: 22,
                                        lineHeight: 1,
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSaveAnnouncement} className="p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Announcement Type
                                    </label>

                                    <div className="flex flex-wrap gap-3">
                                        <label className="inline-flex items-center gap-2 text-sm text-white">
                                            <input
                                                type="radio"
                                                name="announcementType"
                                                checked={form.type === "standard"}
                                                onChange={() =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        type: "standard",
                                                        facebookVideoUrl: "",
                                                    }))
                                                }
                                                disabled={saving}
                                            />
                                            Standard
                                        </label>

                                        <label className="inline-flex items-center gap-2 text-sm text-white">
                                            <input
                                                type="radio"
                                                name="announcementType"
                                                checked={form.type === "livestream"}
                                                onChange={() =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        type: "livestream",
                                                    }))
                                                }
                                                disabled={saving}
                                            />
                                            Livestream
                                        </label>
                                    </div>
                                </div>

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
                                        placeholder="Enter the announcement title"
                                        disabled={saving}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Description
                                    </label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, description: e.target.value }))
                                        }
                                        rows={5}
                                        className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        placeholder="Write the announcement copy"
                                        disabled={saving}
                                    />
                                </div>

                                {form.type === "standard" ? (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                                CTA Label
                                            </label>
                                            <input
                                                type="text"
                                                value={form.ctaLabel}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))
                                                }
                                                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                                style={{ borderRadius: 5 }}
                                                placeholder="Learn More"
                                                disabled={saving}
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                                CTA Link
                                            </label>
                                            <input
                                                type="url"
                                                value={form.ctaLink}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, ctaLink: e.target.value }))
                                                }
                                                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                                style={{ borderRadius: 5 }}
                                                placeholder="https://..."
                                                disabled={saving}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="md:col-span-2">
                                        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                            Facebook Video URL
                                        </label>
                                        <input
                                            type="url"
                                            value={form.facebookVideoUrl}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    facebookVideoUrl: e.target.value,
                                                }))
                                            }
                                            className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                            style={{ borderRadius: 5 }}
                                            placeholder="https://www.facebook.com/.../videos/..."
                                            disabled={saving}
                                        />
                                        <p className="mt-2 text-xs text-zinc-500">
                                            Paste the Facebook video URL here. Don’t paste the full SDK script.
                                        </p>
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Image / Thumbnail (Optional)
                                    </label>

                                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                                        <div
                                            className="overflow-hidden border border-zinc-800 bg-zinc-900"
                                            style={{ width: 160, height: 100, borderRadius: 8 }}
                                        >
                                            {previewUrl ? (
                                                <img
                                                    src={previewUrl}
                                                    alt="New preview"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : editingAnnouncement?.imageUrl ? (
                                                <img
                                                    src={editingAnnouncement.imageUrl}
                                                    alt={editingAnnouncement.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : form.type === "livestream" ? (
                                                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                                                    Optional thumbnail
                                                </div>
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                                                    No image selected
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-xs text-zinc-500">
                                                Optional. The file will only upload after you press Save.
                                            </p>
                                            {selectedImageFile ? (
                                                <p className="mt-2 text-xs text-blue-300">
                                                    Selected — {selectedImageFile.name}
                                                </p>
                                            ) : editingAnnouncement?.imageUrl ? (
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
                                    <label className="flex items-center gap-3 text-sm text-white">
                                        <input
                                            type="checkbox"
                                            checked={form.isActive}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    isActive: e.target.checked,
                                                }))
                                            }
                                            disabled={saving}
                                        />
                                        Set this as the active homepage announcement
                                    </label>
                                </div>
                            </div>

                            {saving ? (
                                <div className="mt-5 rounded-lg border border-blue-500/25 bg-blue-500/10 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-blue-100">
                                            {selectedImageFile ? "Uploading image..." : "Saving announcement..."}
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

                            {formError ? (
                                <p className="mt-5 text-sm text-red-400">{formError}</p>
                            ) : null}

                            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeModal}
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
                                    {saving
                                        ? "Saving..."
                                        : editingAnnouncement
                                            ? "Save Changes"
                                            : "Create Announcement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {deleteTarget ? (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
                    <div
                        className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                        style={{ borderRadius: 10 }}
                    >
                        <h3 className="text-xl font-semibold text-white">Delete Announcement</h3>
                        <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Are you sure you want to delete{" "}
                            <span className="font-semibold text-white">
                                {deleteTarget.title}
                            </span>
                            ?
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
                                onClick={confirmDeleteAnnouncement}
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