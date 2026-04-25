"use client";

import {
    ArrowUp,
    ArrowDown,
    Pencil,
    Trash2,
    ExternalLink,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
    addDoc,
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
import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytesResumable,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import { canManageFeaturedGames } from "@/lib/adminPermissions";

type FeaturedGame = {
    id: string;
    projectTitle: string;
    creatorName: string;
    projectDescription: string;
    projectLink: string;
    imageUrl: string;
    imagePath?: string;
    isPublished: boolean;
    sortOrder: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdByEmail?: string;
    updatedByEmail?: string;
};

type StaffProfile = {
    id: string;
    emailAddress?: string;
    role?: string;
};

type FormState = {
    projectTitle: string;
    creatorName: string;
    projectDescription: string;
    projectLink: string;
    isPublished: boolean;
};

const EMPTY_FORM: FormState = {
    projectTitle: "",
    creatorName: "",
    projectDescription: "",
    projectLink: "",
    isPublished: true,
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

export default function FeaturedGamesAdminPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    const [games, setGames] = useState<FeaturedGame[]>([]);
    const [loadingGames, setLoadingGames] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<FeaturedGame | null>(null);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [imageInputKey, setImageInputKey] = useState(0);

    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [reorderingId, setReorderingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [pageError, setPageError] = useState("");
    const [formError, setFormError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<FeaturedGame | null>(null);

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
                console.error("Error checking featured games access:", error);
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
        return canManageFeaturedGames(staffProfile?.role);
    }, [staffProfile?.role]);

    useEffect(() => {
        if (!user || !hasAccess) {
            setGames([]);
            setLoadingGames(false);
            return;
        }

        setLoadingGames(true);
        setPageError("");

        const q = query(collection(db, "featuredGames"), orderBy("sortOrder", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const rows: FeaturedGame[] = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...(docSnap.data() as Omit<FeaturedGame, "id">),
                }));

                setGames(rows);
                setLoadingGames(false);
            },
            (error) => {
                console.error("Error loading featured games:", error);
                setPageError("Could not load featured games.");
                setLoadingGames(false);
            }
        );

        return () => unsubscribe();
    }, [user, hasAccess]);

    function openCreateModal() {
        setEditingGame(null);
        setForm(EMPTY_FORM);
        setSelectedImageFile(null);
        setPreviewUrl("");
        setImageInputKey((prev) => prev + 1);
        setFormError("");
        setUploadProgress(0);
        setModalOpen(true);
    }

    function openEditModal(game: FeaturedGame) {
        setEditingGame(game);
        setForm({
            projectTitle: game.projectTitle || "",
            creatorName: game.creatorName || "",
            projectDescription: game.projectDescription || "",
            projectLink: game.projectLink || "",
            isPublished: !!game.isPublished,
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
        setEditingGame(null);
        setForm(EMPTY_FORM);
        setSelectedImageFile(null);
        setPreviewUrl("");
        setImageInputKey((prev) => prev + 1);
        setFormError("");
        setUploadProgress(0);
    }

    async function handleSignOut() {
        try {
            await setPresenceOffline(user?.email);
            await signOut(auth);
            router.replace("/admin/login");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    }

    async function uploadFeaturedGameImage(file: File) {
        const extension = file.name.split(".").pop() || "jpg";
        const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const imagePath = `featured-games/${safeBase}.${extension}`;
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
                    (error) => {
                        reject(error);
                    },
                    async () => {
                        try {
                            const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve({
                                imagePath,
                                imageUrl,
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            }
        );
    }

    async function handleSaveGame(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!user?.email) return;

        const projectTitle = form.projectTitle.trim();
        const creatorName = form.creatorName.trim();
        const projectDescription = form.projectDescription.trim();
        const projectLink = form.projectLink.trim();

        if (!projectTitle) {
            setFormError("Project Title is required.");
            return;
        }

        if (!creatorName) {
            setFormError("Creator Name is required.");
            return;
        }

        if (!projectDescription) {
            setFormError("Project Description is required.");
            return;
        }

        if (!projectLink) {
            setFormError("Project Link is required.");
            return;
        }

        if (!isValidUrl(projectLink)) {
            setFormError("Project Link must be a valid full URL.");
            return;
        }

        if (!editingGame && !selectedImageFile) {
            setFormError("Please upload an image for this featured game.");
            return;
        }

        setSaving(true);
        setFormError("");
        setUploadProgress(0);

        try {
            let imageUrl = editingGame?.imageUrl || "";
            let imagePath = editingGame?.imagePath || "";

            if (selectedImageFile) {
                const uploaded = await uploadFeaturedGameImage(selectedImageFile);
                imageUrl = uploaded.imageUrl;
                imagePath = uploaded.imagePath;

                if (editingGame?.imagePath) {
                    try {
                        await deleteObject(ref(storage, editingGame.imagePath));
                    } catch (error) {
                        console.warn("Old featured game image could not be deleted:", error);
                    }
                }
            }

            if (editingGame) {
                await updateDoc(doc(db, "featuredGames", editingGame.id), {
                    projectTitle,
                    creatorName,
                    projectDescription,
                    projectLink,
                    imageUrl,
                    imagePath,
                    isPublished: form.isPublished,
                    updatedAt: serverTimestamp(),
                    updatedByEmail: user.email,
                });
            } else {
                const nextSortOrder =
                    games.length > 0
                        ? Math.max(...games.map((item) => item.sortOrder || 0)) + 1
                        : 1;

                await addDoc(collection(db, "featuredGames"), {
                    projectTitle,
                    creatorName,
                    projectDescription,
                    projectLink,
                    imageUrl,
                    imagePath,
                    isPublished: form.isPublished,
                    sortOrder: nextSortOrder,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdByEmail: user.email,
                    updatedByEmail: user.email,
                });
            }

            closeModal();
        } catch (error) {
            console.error("Error saving featured game:", error);
            setFormError("Could not save this featured game. Please try again.");
        } finally {
            setSaving(false);
            setUploadProgress(0);
        }
    }

    async function togglePublished(game: FeaturedGame) {
        try {
            await updateDoc(doc(db, "featuredGames", game.id), {
                isPublished: !game.isPublished,
                updatedAt: serverTimestamp(),
                updatedByEmail: user?.email || "",
            });
        } catch (error) {
            console.error("Error toggling featured game visibility:", error);
            setPageError("Could not update publish status.");
        }
    }

    async function moveGame(game: FeaturedGame, direction: "up" | "down") {
        const currentIndex = games.findIndex((item) => item.id === game.id);
        if (currentIndex === -1) return;

        const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (swapIndex < 0 || swapIndex >= games.length) return;

        const targetGame = games[swapIndex];

        setReorderingId(game.id);

        try {
            await Promise.all([
                updateDoc(doc(db, "featuredGames", game.id), {
                    sortOrder: targetGame.sortOrder,
                    updatedAt: serverTimestamp(),
                    updatedByEmail: user?.email || "",
                }),
                updateDoc(doc(db, "featuredGames", targetGame.id), {
                    sortOrder: game.sortOrder,
                    updatedAt: serverTimestamp(),
                    updatedByEmail: user?.email || "",
                }),
            ]);
        } catch (error) {
            console.error("Error reordering featured games:", error);
            setPageError("Could not reorder featured games.");
        } finally {
            setReorderingId(null);
        }
    }

    async function confirmDeleteGame() {
        if (!deleteTarget) return;

        setDeletingId(deleteTarget.id);
        setPageError("");

        try {
            if (deleteTarget.imagePath) {
                try {
                    await deleteObject(ref(storage, deleteTarget.imagePath));
                } catch (error) {
                    console.warn("Featured game image could not be deleted:", error);
                }
            }

            await deleteDoc(doc(db, "featuredGames", deleteTarget.id));
            setDeleteTarget(null);
        } catch (error) {
            console.error("Error deleting featured game:", error);
            setPageError("Could not delete this featured game.");
        } finally {
            setDeletingId(null);
        }
    }

    if (authLoading || !user || roleLoading) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="grid min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
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
                        You do not have permission to access Featured Games.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <>
            <main className="min-h-screen bg-zinc-950 text-white lg:pl-[290px]">
                <div className="min-h-screen">
                    <AdminSidebar
                        active="content_featured_games"
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
                                Featured Games
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-white">Featured Games</h1>
                                <p className="mt-1 text-sm text-zinc-400">
                                    Manage the games shown in the homepage Featured Projects section.
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
                                Add Featured Game
                            </button>
                        </div>

                        {pageError ? (
                            <p className="mt-5 text-sm text-red-400">{pageError}</p>
                        ) : null}

                        <div className="mt-6">
                            {loadingGames ? (
                                <div className="p-5 text-sm text-zinc-400">Loading featured games...</div>
                            ) : games.length === 0 ? (
                                <div className="p-5 text-sm text-zinc-400">
                                    No featured games yet. Click “Add Featured Game” to create the first one.
                                </div>
                            ) : (
                                <div className="grid gap-5 p-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {games.map((game, index) => (
                                        <div
                                            key={game.id}
                                            className="overflow-hidden border border-zinc-800 bg-zinc-950/70"
                                            style={{ borderRadius: 12 }}
                                        >
                                            <div
                                                className="overflow-hidden border-b border-zinc-800 bg-zinc-900"
                                                style={{ aspectRatio: "16 / 9" }}
                                            >
                                                {game.imageUrl ? (
                                                    <img
                                                        src={game.imageUrl}
                                                        alt={game.projectTitle}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                                                        No image
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="truncate text-lg font-semibold text-white">
                                                                {game.projectTitle}
                                                            </h3>

                                                            <span
                                                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${game.isPublished
                                                                    ? "border border-blue-500/30 bg-blue-500/15 text-blue-200"
                                                                    : "border border-zinc-700 bg-zinc-800 text-zinc-300"
                                                                    }`}
                                                            >
                                                                {game.isPublished ? "Published" : "Hidden"}
                                                            </span>
                                                        </div>

                                                        <p className="mt-1 text-sm text-zinc-400">by {game.creatorName}</p>
                                                    </div>
                                                </div>

                                                <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-300">
                                                    {game.projectDescription}
                                                </p>

                                                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                                                    <span>Order #{game.sortOrder}</span>
                                                    <span>Updated {formatDate(game.updatedAt)}</span>
                                                </div>

                                                <div className="mt-4">
                                                    <a
                                                        href={game.projectLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span>Open Project Link</span>
                                                    </a>
                                                </div>

                                                <div className="mt-5 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePublished(game)}
                                                        className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                                                    >
                                                        {game.isPublished ? "Unpublish" : "Publish"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(game)}
                                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                                                    >
                                                        <Pencil size={14} />
                                                        <span>Edit</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget(game)}
                                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/15"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveGame(game, "up")}
                                                        disabled={index === 0 || reorderingId === game.id}
                                                        title="Move up"
                                                        aria-label="Move up"
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <ArrowUp size={16} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => moveGame(game, "down")}
                                                        disabled={index === games.length - 1 || reorderingId === game.id}
                                                        title="Move down"
                                                        aria-label="Move down"
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <ArrowDown size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                                        {editingGame ? "Edit Featured Game" : "Add Featured Game"}
                                    </h2>
                                    <p className="mt-2 text-sm text-zinc-400">
                                        Fill in the game details that will appear on the homepage.
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

                        <form onSubmit={handleSaveGame} className="p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Project Title
                                    </label>
                                    <input
                                        type="text"
                                        value={form.projectTitle}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, projectTitle: e.target.value }))
                                        }
                                        className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        placeholder="Enter the project title"
                                        disabled={saving}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Creator Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.creatorName}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, creatorName: e.target.value }))
                                        }
                                        className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        placeholder="Enter the creator name"
                                        disabled={saving}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Project Link
                                    </label>
                                    <input
                                        type="url"
                                        value={form.projectLink}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, projectLink: e.target.value }))
                                        }
                                        className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        placeholder="https://www.roblox.com/..."
                                        disabled={saving}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Project Description
                                    </label>
                                    <textarea
                                        value={form.projectDescription}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                projectDescription: e.target.value,
                                            }))
                                        }
                                        rows={5}
                                        className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        placeholder="Write a short description for the homepage card"
                                        disabled={saving}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                        Image
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
                                            ) : editingGame?.imageUrl ? (
                                                <img
                                                    src={editingGame.imageUrl}
                                                    alt={editingGame.projectTitle}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                                                    No image selected
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-xs text-zinc-500">
                                                The image will only upload after you press Save.
                                            </p>
                                            {selectedImageFile ? (
                                                <p className="mt-2 text-xs text-blue-300">
                                                    Selected — {selectedImageFile.name}
                                                </p>
                                            ) : editingGame?.imageUrl ? (
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
                                            checked={form.isPublished}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    isPublished: e.target.checked,
                                                }))
                                            }
                                            disabled={saving}
                                        />
                                        Publish this game immediately
                                    </label>
                                </div>
                            </div>

                            {saving ? (
                                <div className="mt-5 rounded-lg border border-blue-500/25 bg-blue-500/10 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-blue-100">
                                            {selectedImageFile ? "Uploading image..." : "Saving game..."}
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
                                        : editingGame
                                            ? "Save Changes"
                                            : "Create Game"}
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
                        <h3 className="text-xl font-semibold text-white">Delete Featured Game</h3>
                        <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Are you sure you want to delete{" "}
                            <span className="font-semibold text-white">
                                {deleteTarget.projectTitle}
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
                                onClick={confirmDeleteGame}
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