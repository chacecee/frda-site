"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import {
    getDownloadURL,
    ref,
    uploadBytesResumable,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import {
    cleanRobloxGameUrl,
    GAME_CONTENT_MATURITY_OPTIONS,
    GAME_GENRE_OPTIONS,
    GAME_STATUS_OPTIONS,
    GameContentMaturity,
    GameDirectoryGenre,
    GameDirectoryItem,
    GameDirectoryStatus,
    getGameContentMaturityLabel,
    getGameGenreLabel,
    getGameStatusLabel,
    isProbablyRobloxGameUrl,
    normalizeGameContentMaturity,
    normalizeGameDirectoryStatus,
    normalizeGameGenre,
} from "@/lib/gameDirectory";
import {
    Archive,
    CheckCircle2,
    Clock3,
    XCircle,
} from "lucide-react";

type GameFormState = {
    title: string;
    description: string;
    robloxUrl: string;
    creatorName: string;
    creatorType: "individual" | "group";
    memberId: string;
    genre: GameDirectoryGenre;
    contentMaturity: GameContentMaturity;
    thumbnailUrl: string;
    thumbnailPath: string;
    coverImageUrl: string;
    coverImagePath: string;
    isSponsored: boolean;
    isHighlighted: boolean;
};

const DESCRIPTION_LIMIT = 500;

const EMPTY_FORM: GameFormState = {
    title: "",
    description: "",
    robloxUrl: "",
    creatorName: "",
    creatorType: "individual",
    memberId: "",
    genre: "action",
    contentMaturity: "minimal",
    thumbnailUrl: "",
    thumbnailPath: "",
    coverImageUrl: "",
    coverImagePath: "",
    isSponsored: false,
    isHighlighted: false,
};

function normalizeText(value?: string | null) {
    return value?.trim().toLowerCase() || "";
}

function formatTimestamp(timestamp?: Timestamp) {
    if (!timestamp) return "—";

    return timestamp.toDate().toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function getStatusBadgeClass(status: GameDirectoryStatus) {
    switch (status) {
        case "published":
            return "border-blue-500/25 bg-blue-500/15 text-blue-200";
        case "pending":
            return "border-amber-500/25 bg-amber-500/15 text-amber-200";
        case "declined":
            return "border-red-500/25 bg-red-500/15 text-red-200";
        case "archived":
            return "border-zinc-600/40 bg-zinc-700/30 text-zinc-300";
        default:
            return "border-sky-500/25 bg-sky-500/15 text-sky-200";
    }
}

function getSourceLabel(source?: string) {
    if (source === "member_submission") return "Member submission";
    return "Staff added";
}

function FilterButton({
    label,
    active,
    count,
    onClick,
}: {
    label: string;
    active: boolean;
    count: number;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`shrink-0 cursor-pointer whitespace-nowrap border px-4 py-2 text-sm font-medium transition ${active
                ? "border-blue-400/50 bg-blue-500/15 text-white"
                : "border-zinc-700 bg-zinc-950/40 text-zinc-400 hover:text-white"
                }`}
            style={{ borderRadius: 999 }}
        >
            {label}
            <span className="ml-2 text-xs text-zinc-500">{count}</span>
        </button>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {children}
        </label>
    );
}

function TextInput({
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
            style={{ borderRadius: 5 }}
        />
    );
}

type ActionTone = "neutral" | "blue" | "amber" | "red" | "zinc";

function GameActionButton({
    label,
    icon,
    tone = "neutral",
    disabled,
    onClick,
}: {
    label: string;
    icon: React.ReactNode;
    tone?: ActionTone;
    disabled?: boolean;
    onClick: () => void;
}) {
    const toneClass =
        tone === "blue"
            ? "border-blue-400/35 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15"
            : tone === "amber"
                ? "border-amber-400/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                : tone === "red"
                    ? "border-red-400/35 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                    : tone === "zinc"
                        ? "border-zinc-600 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800"
                        : "border-zinc-700 bg-zinc-950/50 text-zinc-200 hover:bg-zinc-800/70";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={label}
            className={`inline-flex h-9 items-center justify-center gap-2 border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
            style={{ borderRadius: 5 }}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function SelectInput({
    value,
    onChange,
    children,
}: {
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            style={{ borderRadius: 5 }}
        >
            {children}
        </select>
    );
}

export default function AdminGamesPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [games, setGames] = useState<GameDirectoryItem[]>([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [search, setSearch] = useState("");
    const [activeStatus, setActiveStatus] =
        useState<GameDirectoryStatus>("for_approval");

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<GameDirectoryItem | null>(null);
    const [form, setForm] = useState<GameFormState>(EMPTY_FORM);
    const [formError, setFormError] = useState("");

    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
    const [thumbnailInputKey, setThumbnailInputKey] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadLabel, setUploadLabel] = useState("");

    const [savingGame, setSavingGame] = useState(false);
    const [updatingGameId, setUpdatingGameId] = useState<string | null>(null);

    const displayName =
        user?.displayName?.trim() ||
        (user?.email ? user.email.split("@")[0] : "Unknown User");

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/admin/login");
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        let objectUrl: string | null = null;

        if (selectedThumbnailFile) {
            objectUrl = URL.createObjectURL(selectedThumbnailFile);
            setThumbnailPreviewUrl(objectUrl);
        } else {
            setThumbnailPreviewUrl("");
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedThumbnailFile]);

    useEffect(() => {
        if (!user) return;

        setLoadingGames(true);
        setErrorMsg("");

        const gamesQuery = query(
            collection(db, "gameDirectory"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            gamesQuery,
            (snapshot) => {
                const rows: GameDirectoryItem[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as Omit<GameDirectoryItem, "id">;

                    return {
                        id: docSnap.id,
                        ...data,
                        status: normalizeGameDirectoryStatus(data.status),
                        genre: normalizeGameGenre(data.genre),
                        contentMaturity: normalizeGameContentMaturity(data.contentMaturity),
                    };
                });

                setGames(rows);
                setLoadingGames(false);
            },
            (error) => {
                console.error("Error loading game directory:", error);
                setErrorMsg("Could not load game directory.");
                setLoadingGames(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    const statusCounts = useMemo(() => {
        const counts: Record<GameDirectoryStatus, number> = {
            for_approval: 0,
            published: 0,
            pending: 0,
            declined: 0,
            archived: 0,
        };

        games.forEach((game) => {
            counts[normalizeGameDirectoryStatus(game.status)] += 1;
        });

        return counts;
    }, [games]);

    const filteredGames = useMemo(() => {
        const q = normalizeText(search);

        return games.filter((game) => {
            if (game.status !== activeStatus) return false;

            if (!q) return true;

            const searchableText = [
                game.title,
                game.description,
                game.creatorName,
                game.memberId,
                game.robloxUrl,
                game.submittedByName,
                game.uploadedByName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(q);
        });
    }, [games, activeStatus, search]);

    function openAddModal() {
        setEditingGame(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setSelectedThumbnailFile(null);
        setThumbnailPreviewUrl("");
        setThumbnailInputKey((prev) => prev + 1);
        setUploadProgress(0);
        setUploadLabel("");
        setAddModalOpen(true);
    }

    function openEditModal(game: GameDirectoryItem) {
        setEditingGame(game);

        setForm({
            title: game.title || "",
            description: game.description || "",
            robloxUrl: game.robloxUrl || "",
            creatorName: game.creatorName || "",
            creatorType: game.creatorType === "group" ? "group" : "individual",
            memberId: game.memberId || "",
            genre: normalizeGameGenre(game.genre),
            contentMaturity: normalizeGameContentMaturity(game.contentMaturity),
            thumbnailUrl: game.thumbnailUrl || "",
            thumbnailPath: game.thumbnailPath || "",
            coverImageUrl: game.coverImageUrl || "",
            coverImagePath: game.coverImagePath || "",
            isSponsored: !!game.isSponsored,
            isHighlighted: !!game.isHighlighted,
        });

        setFormError("");
        setSelectedThumbnailFile(null);
        setThumbnailPreviewUrl("");
        setThumbnailInputKey((prev) => prev + 1);
        setUploadProgress(0);
        setUploadLabel("");
        setAddModalOpen(true);
    }

    function closeAddModal() {
        if (savingGame) return;

        setAddModalOpen(false);
        setEditingGame(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setSelectedThumbnailFile(null);
        setThumbnailPreviewUrl("");
        setThumbnailInputKey((prev) => prev + 1);
        setUploadProgress(0);
        setUploadLabel("");
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

    function isValidImageFile(file: File) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        const maxSizeMb = 5;
        const maxSizeBytes = maxSizeMb * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            return "Please upload a JPG, PNG, WEBP, or GIF image.";
        }

        if (file.size > maxSizeBytes) {
            return `Please upload an image smaller than ${maxSizeMb}MB.`;
        }

        return "";
    }

    async function uploadGameDirectoryImage(file: File) {
        const validationError = isValidImageFile(file);

        if (validationError) {
            throw new Error(validationError);
        }

        const extension = file.name.split(".").pop() || "jpg";
        const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const imagePath = `game-directory/thumbnails/${safeBase}.${extension}`;
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

    function validateForm() {
        const title = form.title.trim();
        const description = form.description.trim();
        const robloxUrl = cleanRobloxGameUrl(form.robloxUrl);
        const creatorName = form.creatorName.trim();

        if (!title) return "Please enter the game title.";
        if (!creatorName) return "Please enter the developer or group name.";
        if (!description) return "Please enter a short game description.";
        if (description.length > DESCRIPTION_LIMIT) {
            return `Description must be ${DESCRIPTION_LIMIT} characters or less.`;
        }

        if (!robloxUrl) return "Please enter the Roblox game link.";
        if (!isProbablyRobloxGameUrl(robloxUrl)) {
            return "Please enter a valid Roblox game, share, or community link.";
        }

        return "";
    }

    async function addStaffGame() {
        if (!user) return;

        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSavingGame(true);
        setFormError("");
        setUploadProgress(0);
        setUploadLabel("");

        try {
            let thumbnailUrl = form.thumbnailUrl.trim();
            let thumbnailPath = form.thumbnailPath.trim();

            if (selectedThumbnailFile) {
                setUploadLabel("Uploading thumbnail...");
                const uploadedThumbnail = await uploadGameDirectoryImage(selectedThumbnailFile);

                thumbnailUrl = uploadedThumbnail.imageUrl;
                thumbnailPath = uploadedThumbnail.imagePath;
            }

            setUploadLabel("Saving game...");

            await addDoc(collection(db, "gameDirectory"), {
                title: form.title.trim(),
                description: form.description.trim().slice(0, DESCRIPTION_LIMIT),
                robloxUrl: cleanRobloxGameUrl(form.robloxUrl),

                creatorName: form.creatorName.trim(),
                creatorType: form.creatorType,
                memberId: form.memberId.trim(),

                genre: form.genre,
                contentMaturity: form.contentMaturity,

                thumbnailUrl,
                thumbnailPath,
                coverImageUrl: "",
                coverImagePath: "",

                isSponsored: form.isSponsored,
                isHighlighted: form.isHighlighted,
                isHiddenFromPublic: false,

                status: "for_approval",
                source: "staff_added",

                uploadedByUid: user.uid,
                uploadedByName: displayName,
                uploadedByEmail: user.email || "",
                uploadedAt: serverTimestamp(),

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setAddModalOpen(false);
            setForm(EMPTY_FORM);
        } catch (error) {
            console.error("Error adding game:", error);
            setFormError("Could not add this game. Please try again.");
        } finally {
            setSavingGame(false);
            setUploadProgress(0);
            setUploadLabel("");
        }
    }

    async function saveEditedGame(nextStatus?: GameDirectoryStatus) {
        if (!user || !editingGame) return;

        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSavingGame(true);
        setFormError("");
        setUploadProgress(0);
        setUploadLabel("");

        try {
            let thumbnailUrl = form.thumbnailUrl.trim();
            let thumbnailPath = form.thumbnailPath.trim();

            if (selectedThumbnailFile) {
                setUploadLabel("Uploading new thumbnail...");
                const uploadedThumbnail = await uploadGameDirectoryImage(selectedThumbnailFile);

                thumbnailUrl = uploadedThumbnail.imageUrl;
                thumbnailPath = uploadedThumbnail.imagePath;
            }

            setUploadLabel(
                nextStatus
                    ? `Saving changes and marking as ${getGameStatusLabel(nextStatus)}...`
                    : "Saving changes..."
            );

            const updatePayload: Record<string, unknown> = {
                title: form.title.trim(),
                description: form.description.trim().slice(0, DESCRIPTION_LIMIT),
                robloxUrl: cleanRobloxGameUrl(form.robloxUrl),

                creatorName: form.creatorName.trim(),
                creatorType: form.creatorType,
                memberId: form.memberId.trim(),

                genre: form.genre,
                contentMaturity: form.contentMaturity,

                thumbnailUrl,
                thumbnailPath,

                isSponsored: form.isSponsored,
                isHighlighted: form.isHighlighted,

                editedByUid: user.uid,
                editedByName: displayName,
                editedByEmail: user.email || "",
                editedAt: serverTimestamp(),

                updatedAt: serverTimestamp(),
            };

            if (nextStatus) {
                updatePayload.status = nextStatus;
                updatePayload.isHiddenFromPublic = nextStatus !== "published";

                updatePayload.reviewedByUid = user.uid;
                updatePayload.reviewedByName = displayName;
                updatePayload.reviewedByEmail = user.email || "";
                updatePayload.reviewedAt = serverTimestamp();
            }

            await updateDoc(doc(db, "gameDirectory", editingGame.id), updatePayload);

            closeAddModal();
        } catch (error) {
            console.error("Error saving game changes:", error);
            setFormError("Could not save changes. Please try again.");
        } finally {
            setSavingGame(false);
            setUploadProgress(0);
            setUploadLabel("");
        }
    }

    async function updateGameStatus(
        game: GameDirectoryItem,
        nextStatus: GameDirectoryStatus
    ) {
        if (!user) return;

        setUpdatingGameId(game.id);

        try {
            await updateDoc(doc(db, "gameDirectory", game.id), {
                status: nextStatus,
                isHiddenFromPublic: nextStatus !== "published" ? true : false,

                reviewedByUid: user.uid,
                reviewedByName: displayName,
                reviewedByEmail: user.email || "",
                reviewedAt: serverTimestamp(),

                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating game status:", error);
            alert("Could not update this game.");
        } finally {
            setUpdatingGameId(null);
        }
    }

    if (authLoading || !user) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <p className="text-sm text-zinc-400">Loading game directory...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
            <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
                <AdminSidebar
                    active="content_game_directory"
                    sidebarOpen={sidebarOpen}
                    onCloseSidebar={() => setSidebarOpen(false)}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    displayName={displayName}
                    email={user.email}
                />

                <section className="min-w-0 w-full max-w-full overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
                    <div className="mb-5 flex items-center gap-3 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="cursor-pointer bg-zinc-900 px-3 py-2 text-sm text-white"
                            style={{ borderRadius: 8 }}
                        >
                            ☰
                        </button>
                        <p className="text-2xl font-semibold leading-none text-white">
                            Game Directory
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">Game Directory</h1>
                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                Review, publish, archive, and manage Roblox experiences listed on
                                the public FRDA directory.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={openAddModal}
                            className="w-full cursor-pointer border border-blue-400/40 bg-blue-500/15 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 md:w-auto"
                            style={{ borderRadius: 5 }}
                        >
                            Add Game
                        </button>
                    </div>

                    <div className="mb-5">
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by game title, description, creator, member ID, uploader, or Roblox URL"
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                        />
                    </div>

                    <div className="mb-6 max-w-full overflow-x-auto">
                        <div className="flex w-max gap-2">
                            {GAME_STATUS_OPTIONS.map((status) => (
                                <FilterButton
                                    key={status.value}
                                    label={status.label}
                                    count={statusCounts[status.value]}
                                    active={activeStatus === status.value}
                                    onClick={() => setActiveStatus(status.value)}
                                />
                            ))}
                        </div>
                    </div>

                    {errorMsg ? (
                        <div
                            className="mb-6 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                            style={{ borderRadius: 8 }}
                        >
                            {errorMsg}
                        </div>
                    ) : null}

                    <div
                        className="hidden overflow-hidden border border-zinc-800 bg-zinc-950/25 md:block"
                        style={{ borderRadius: 8 }}
                    >
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="border-b border-zinc-800 bg-zinc-950/60">
                                    <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
                                        <th className="px-5 py-3">Game</th>
                                        <th className="px-5 py-3">Creator</th>
                                        <th className="px-5 py-3">Genre</th>
                                        <th className="px-5 py-3">Maturity</th>
                                        <th className="px-5 py-3">Source</th>
                                        <th className="px-5 py-3">Uploaded / Submitted</th>
                                        <th className="px-5 py-3">Reviewed</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loadingGames ? (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-6 text-sm text-zinc-500">
                                                Loading games...
                                            </td>
                                        </tr>
                                    ) : filteredGames.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-6 text-sm text-zinc-500">
                                                No games found in this tab.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredGames.map((game) => (
                                            <tr
                                                key={game.id}
                                                className="border-b border-zinc-800/80 text-sm last:border-b-0"
                                            >
                                                <td className="max-w-[320px] px-5 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(game)}
                                                            className="h-14 w-20 shrink-0 cursor-pointer overflow-hidden border border-zinc-800 bg-zinc-950 transition hover:border-blue-400/50"
                                                            style={{ borderRadius: 5 }}
                                                            title="Open listing details"
                                                        >
                                                            {game.thumbnailUrl ? (
                                                                <img
                                                                    src={game.thumbnailUrl}
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-zinc-600">
                                                                    No image
                                                                </div>
                                                            )}
                                                        </button>

                                                        <div className="min-w-0">
                                                            <a
                                                                href={game.robloxUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block truncate font-semibold text-white underline-offset-4 hover:text-blue-300 hover:underline"
                                                            >
                                                                {game.title}
                                                            </a>
                                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                                                {game.description}
                                                            </p>
                                                            <span
                                                                className={`mt-2 inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                                                                    game.status
                                                                )}`}
                                                                style={{ borderRadius: 999 }}
                                                            >
                                                                {getGameStatusLabel(game.status)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-zinc-300">
                                                    <div className="font-medium text-zinc-200">
                                                        {game.creatorName || "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-zinc-500">
                                                        {game.creatorType === "group" ? "Group" : "Individual"}
                                                        {game.memberId ? ` · ${game.memberId}` : ""}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-zinc-300">
                                                    {getGameGenreLabel(game.genre)}
                                                </td>

                                                <td className="px-5 py-4 text-zinc-300">
                                                    {getGameContentMaturityLabel(game.contentMaturity)}
                                                </td>

                                                <td className="px-5 py-4 text-zinc-400">
                                                    {getSourceLabel(game.source)}
                                                </td>

                                                <td className="px-5 py-4 text-zinc-400">
                                                    <div>
                                                        {game.uploadedByName ||
                                                            game.submittedByName ||
                                                            game.uploadedByEmail ||
                                                            game.submittedByEmail ||
                                                            "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-zinc-600">
                                                        {formatTimestamp(game.uploadedAt || game.submittedAt)}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-zinc-400">
                                                    <div>
                                                        {game.reviewedByName || game.reviewedByEmail || "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-zinc-600">
                                                        {formatTimestamp(game.reviewedAt)}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex min-w-[180px] flex-wrap justify-end gap-2">

                                                        {game.status !== "published" ? (
                                                            <GameActionButton
                                                                label="Publish"
                                                                tone="blue"
                                                                disabled={updatingGameId === game.id}
                                                                onClick={() => updateGameStatus(game, "published")}
                                                                icon={<CheckCircle2 size={14} />}
                                                            />
                                                        ) : null}

                                                        {game.status !== "pending" ? (
                                                            <GameActionButton
                                                                label="Pending"
                                                                tone="amber"
                                                                disabled={updatingGameId === game.id}
                                                                onClick={() => updateGameStatus(game, "pending")}
                                                                icon={<Clock3 size={14} />}
                                                            />
                                                        ) : null}

                                                        {game.status !== "declined" ? (
                                                            <GameActionButton
                                                                label="Decline"
                                                                tone="red"
                                                                disabled={updatingGameId === game.id}
                                                                onClick={() => updateGameStatus(game, "declined")}
                                                                icon={<XCircle size={14} />}
                                                            />
                                                        ) : null}

                                                        {game.status !== "archived" ? (
                                                            <GameActionButton
                                                                label="Archive"
                                                                tone="zinc"
                                                                disabled={updatingGameId === game.id}
                                                                onClick={() => updateGameStatus(game, "archived")}
                                                                icon={<Archive size={14} />}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-4 md:hidden">
                        {loadingGames ? (
                            <div
                                className="border border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500"
                                style={{ borderRadius: 8 }}
                            >
                                Loading games...
                            </div>
                        ) : filteredGames.length === 0 ? (
                            <div
                                className="border border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500"
                                style={{ borderRadius: 8 }}
                            >
                                No games found in this tab.
                            </div>
                        ) : (
                            filteredGames.map((game) => (
                                <div
                                    key={game.id}
                                    className="border border-zinc-800 bg-zinc-950/30 p-4"
                                    style={{ borderRadius: 8 }}
                                >
                                    <div className="flex gap-3">
                                        <div
                                            className="h-16 w-24 shrink-0 overflow-hidden border border-zinc-800 bg-zinc-950"
                                            style={{ borderRadius: 5 }}
                                        >
                                            {game.thumbnailUrl ? (
                                                <img
                                                    src={game.thumbnailUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-zinc-600">
                                                    No image
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <a
                                                href={game.robloxUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block truncate font-semibold text-white"
                                            >
                                                {game.title}
                                            </a>
                                            <p className="mt-1 text-sm text-zinc-400">
                                                {game.creatorName || "—"}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                {getGameGenreLabel(game.genre)} ·{" "}
                                                {getGameContentMaturityLabel(game.contentMaturity)}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-500">
                                        {game.description}
                                    </p>

                                    <div className="mt-4 flex flex-wrap gap-2">

                                        {game.status !== "published" ? (
                                            <GameActionButton
                                                label="Publish"
                                                tone="blue"
                                                disabled={updatingGameId === game.id}
                                                onClick={() => updateGameStatus(game, "published")}
                                                icon={<CheckCircle2 size={14} />}
                                            />
                                        ) : null}

                                        {game.status !== "pending" ? (
                                            <GameActionButton
                                                label="Pending"
                                                tone="amber"
                                                disabled={updatingGameId === game.id}
                                                onClick={() => updateGameStatus(game, "pending")}
                                                icon={<Clock3 size={14} />}
                                            />
                                        ) : null}

                                        {game.status !== "declined" ? (
                                            <GameActionButton
                                                label="Decline"
                                                tone="red"
                                                disabled={updatingGameId === game.id}
                                                onClick={() => updateGameStatus(game, "declined")}
                                                icon={<XCircle size={14} />}
                                            />
                                        ) : null}

                                        {game.status !== "archived" ? (
                                            <GameActionButton
                                                label="Archive"
                                                tone="zinc"
                                                disabled={updatingGameId === game.id}
                                                onClick={() => updateGameStatus(game, "archived")}
                                                icon={<Archive size={14} />}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {addModalOpen ? (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
                    <div className="flex min-h-full items-start justify-center py-8">
                        <div
                            className="w-full max-w-3xl border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                            style={{ borderRadius: 10 }}
                        >
                            <div className="border-b border-zinc-800 px-6 py-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">
                                            {editingGame ? "Edit Game" : "Add Game"}
                                        </h2>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            {editingGame
                                                ? "Update this game listing before publishing or keeping it in review."
                                                : "Staff-added games start in For Approval before going public."}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={closeAddModal}
                                        className="cursor-pointer border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                                        style={{ borderRadius: 5 }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-5 px-6 py-6">
                                {formError ? (
                                    <div
                                        className="border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                                        style={{ borderRadius: 5 }}
                                    >
                                        {formError}
                                    </div>
                                ) : null}

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <FieldLabel>Game Title</FieldLabel>
                                        <TextInput
                                            value={form.title}
                                            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
                                            placeholder="Example: Shadow City"
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel>Developer / Group Name</FieldLabel>
                                        <TextInput
                                            value={form.creatorName}
                                            onChange={(value) =>
                                                setForm((prev) => ({ ...prev, creatorName: value }))
                                            }
                                            placeholder="Creator name or Roblox group"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <FieldLabel>Description</FieldLabel>
                                    <textarea
                                        value={form.description}
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                description: event.target.value.slice(0, DESCRIPTION_LIMIT),
                                            }))
                                        }
                                        rows={5}
                                        placeholder="Write a short public-facing description of the game."
                                        className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                    />
                                    <p className="mt-2 text-right text-xs text-zinc-500">
                                        {form.description.length}/{DESCRIPTION_LIMIT}
                                    </p>
                                </div>

                                <div>
                                    <FieldLabel>Roblox Game Link</FieldLabel>
                                    <TextInput
                                        value={form.robloxUrl}
                                        onChange={(value) =>
                                            setForm((prev) => ({ ...prev, robloxUrl: value }))
                                        }
                                        placeholder="https://www.roblox.com/games/..."
                                    />
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <FieldLabel>Creator Type</FieldLabel>
                                        <SelectInput
                                            value={form.creatorType}
                                            onChange={(value) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    creatorType: value === "group" ? "group" : "individual",
                                                }))
                                            }
                                        >
                                            <option value="individual">Individual</option>
                                            <option value="group">Group</option>
                                        </SelectInput>
                                    </div>

                                    <div>
                                        <FieldLabel>Member ID Optional</FieldLabel>
                                        <TextInput
                                            value={form.memberId}
                                            onChange={(value) =>
                                                setForm((prev) => ({ ...prev, memberId: value }))
                                            }
                                            placeholder="Example: FRDA-M-L37MJ2JN"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <FieldLabel>Genre</FieldLabel>
                                        <SelectInput
                                            value={form.genre}
                                            onChange={(value) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    genre: normalizeGameGenre(value),
                                                }))
                                            }
                                        >
                                            {GAME_GENRE_OPTIONS.map((genre) => (
                                                <option key={genre.value} value={genre.value}>
                                                    {genre.label}
                                                </option>
                                            ))}
                                        </SelectInput>
                                    </div>

                                    <div>
                                        <FieldLabel>Content Maturity</FieldLabel>
                                        <SelectInput
                                            value={form.contentMaturity}
                                            onChange={(value) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    contentMaturity: normalizeGameContentMaturity(value),
                                                }))
                                            }
                                        >
                                            {GAME_CONTENT_MATURITY_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </SelectInput>
                                    </div>
                                </div>

                                <div>
                                    <FieldLabel>Thumbnail Image Optional</FieldLabel>

                                    <p className="mb-3 text-xs leading-5 text-zinc-500">
                                        Recommended size: 1280 × 720 px. This image appears on public game cards.
                                    </p>

                                    <div
                                        className="mb-3 max-w-xl overflow-hidden border border-zinc-800 bg-zinc-950"
                                        style={{ borderRadius: 5, aspectRatio: "16 / 9" }}
                                    >
                                        {thumbnailPreviewUrl || form.thumbnailUrl ? (
                                            <img
                                                src={thumbnailPreviewUrl || form.thumbnailUrl}
                                                alt="Thumbnail preview"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                                                No thumbnail selected — 16:9 recommended
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        key={thumbnailInputKey}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        onChange={(event) =>
                                            setSelectedThumbnailFile(event.target.files?.[0] || null)
                                        }
                                        className="block w-full max-w-xl text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
                                        disabled={savingGame}
                                    />

                                    {selectedThumbnailFile ? (
                                        <p className="mt-2 text-xs text-blue-300">
                                            Selected — {selectedThumbnailFile.name}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label
                                        className="flex cursor-pointer items-center gap-3 border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300"
                                        style={{ borderRadius: 5 }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.isHighlighted}
                                            onChange={(event) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    isHighlighted: event.target.checked,
                                                }))
                                            }
                                        />
                                        Mark as highlighted
                                    </label>

                                    <label
                                        className="flex cursor-pointer items-center gap-3 border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300"
                                        style={{ borderRadius: 5 }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.isSponsored}
                                            onChange={(event) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    isSponsored: event.target.checked,
                                                }))
                                            }
                                        />
                                        Mark as sponsored
                                    </label>
                                </div>
                            </div>

                            {savingGame ? (
                                <div className="mx-6 mb-5 rounded-lg border border-blue-500/25 bg-blue-500/10 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-blue-100">
                                            {uploadLabel || "Saving game..."}
                                        </p>

                                        {selectedThumbnailFile ? (
                                            <span className="text-xs text-blue-200">
                                                {Math.round(uploadProgress)}%
                                            </span>
                                        ) : null}
                                    </div>

                                    {selectedThumbnailFile ? (
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

                            {editingGame ? (
                                <div className="flex flex-col gap-4 border-t border-zinc-800 px-6 py-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            {editingGame.status !== "archived" ? (
                                                <GameActionButton
                                                    label="Archive"
                                                    tone="zinc"
                                                    disabled={savingGame}
                                                    onClick={() => saveEditedGame("archived")}
                                                    icon={<Archive size={14} />}
                                                />
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-2">
                                            {editingGame.status !== "pending" ? (
                                                <GameActionButton
                                                    label="Pending"
                                                    tone="amber"
                                                    disabled={savingGame}
                                                    onClick={() => saveEditedGame("pending")}
                                                    icon={<Clock3 size={14} />}
                                                />
                                            ) : null}

                                            {editingGame.status !== "declined" ? (
                                                <GameActionButton
                                                    label="Decline"
                                                    tone="red"
                                                    disabled={savingGame}
                                                    onClick={() => saveEditedGame("declined")}
                                                    icon={<XCircle size={14} />}
                                                />
                                            ) : null}

                                            {editingGame.status !== "published" ? (
                                                <GameActionButton
                                                    label="Publish"
                                                    tone="blue"
                                                    disabled={savingGame}
                                                    onClick={() => saveEditedGame("published")}
                                                    icon={<CheckCircle2 size={14} />}
                                                />
                                            ) : null}

                                            <button
                                                type="button"
                                                onClick={closeAddModal}
                                                disabled={savingGame}
                                                className="cursor-pointer border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                style={{ borderRadius: 5 }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-xs leading-5 text-zinc-500">
                                        Any edits made above will be saved when you choose a status action.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-5 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeAddModal}
                                        disabled={savingGame}
                                        className="cursor-pointer border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                                        style={{ borderRadius: 5 }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={addStaffGame}
                                        disabled={savingGame}
                                        className="cursor-pointer border border-blue-400/40 bg-blue-500/15 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        style={{ borderRadius: 5 }}
                                    >
                                        {savingGame ? "Saving..." : "Save Game"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}