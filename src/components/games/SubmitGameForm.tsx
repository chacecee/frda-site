"use client";

import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { logAnalyticsEvent } from "@/lib/analytics";
import {
    GAME_CONTENT_MATURITY_OPTIONS,
    GAME_GENRE_OPTIONS,
} from "@/lib/gameDirectory";

const DESCRIPTION_LIMIT = 500;

type SubmitState = "idle" | "submitting" | "success";

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {children}
        </label>
    );
}

function TextInput({
    name,
    value,
    onChange,
    placeholder,
    type = "text",
    required = false,
}: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <input
            name={name}
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
            style={{ borderRadius: 5 }}
        />
    );
}

function FileInput({
    label,
    helper,
    file,
    previewUrl,
    onChange,
}: {
    label: string;
    helper: string;
    file: File | null;
    previewUrl: string;
    onChange: (file: File | null) => void;
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>

            <p className="mb-3 text-xs leading-5 text-zinc-500">{helper}</p>

            <div
                className="mb-3 overflow-hidden border border-zinc-800 bg-zinc-950"
                style={{ borderRadius: 5, aspectRatio: "16 / 9" }}
            >
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={`${label} preview`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-zinc-600">
                        <UploadCloud size={22} />
                        <span>No image selected</span>
                    </div>
                )}
            </div>

            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => onChange(event.target.files?.[0] || null)}
                className="block w-full text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
            />

            {file ? (
                <p className="mt-2 text-xs text-blue-300">Selected — {file.name}</p>
            ) : null}
        </div>
    );
}

export default function SubmitGameForm({
    onSuccess,
}: {
    onSuccess?: () => void;
}) {
    const [formStartedAt, setFormStartedAt] = useState("");
    const [memberId, setMemberId] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [robloxUrl, setRobloxUrl] = useState("");
    const [creatorName, setCreatorName] = useState("");
    const [creatorType, setCreatorType] = useState<"individual" | "group">(
        "individual"
    );
    const [genre, setGenre] = useState("action");
    const [contentMaturity, setContentMaturity] = useState("minimal");

    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");

    const [companyWebsite, setCompanyWebsite] = useState("");

    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        setFormStartedAt(String(Date.now()));
    }, []);

    useEffect(() => {
        let objectUrl: string | null = null;

        if (thumbnailFile) {
            objectUrl = URL.createObjectURL(thumbnailFile);
            setThumbnailPreviewUrl(objectUrl);
        } else {
            setThumbnailPreviewUrl("");
        }

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [thumbnailFile]);

    function validateBeforeSubmit() {
        if (!memberId.trim()) return "Please enter your FRDA member ID.";
        if (!contactEmail.trim()) return "Please enter your contact email.";
        if (!title.trim()) return "Please enter your game title.";
        if (!creatorName.trim()) return "Please enter the developer or group name.";
        if (!description.trim()) return "Please enter a short game description.";
        if (description.length > DESCRIPTION_LIMIT) {
            return `Description must be ${DESCRIPTION_LIMIT} characters or less.`;
        }
        if (!robloxUrl.trim()) return "Please enter your Roblox game link.";

        const maxFileSize = 5 * 1024 * 1024;

        if (!thumbnailFile) {
            return "Please upload a thumbnail image for your game.";
        }

        if (thumbnailFile.size > maxFileSize) {
            return "Thumbnail image must be smaller than 5MB.";
        }

        return "";
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const validationError = validateBeforeSubmit();

        if (validationError) {
            setErrorMsg(validationError);
            return;
        }

        setSubmitState("submitting");
        setErrorMsg("");

        try {
            const body = new FormData();

            body.set("formStartedAt", formStartedAt);
            body.set("companyWebsite", companyWebsite);

            body.set("memberId", memberId);
            body.set("contactEmail", contactEmail);
            body.set("title", title);
            body.set("description", description);
            body.set("robloxUrl", robloxUrl);
            body.set("creatorName", creatorName);
            body.set("creatorType", creatorType);
            body.set("genre", genre);
            body.set("contentMaturity", contentMaturity);

            if (thumbnailFile) {
                body.set("thumbnail", thumbnailFile);
            }

            const response = await fetch("/api/games/submit", {
                method: "POST",
                body,
            });

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(result?.error || "Could not submit your game.");
            }

            logAnalyticsEvent({
                eventName: "game_submission_completed",
                path: "/games/submit",
                metadata: {
                    gameTitle: title,
                    creatorName,
                    genre,
                    contentMaturity,
                },
            });

            setSubmitState("success");
            onSuccess?.();
        } catch (error) {
            console.error("Submit game error:", error);
            setErrorMsg(
                error instanceof Error
                    ? error.message
                    : "Could not submit your game. Please try again."
            );
            setSubmitState("idle");
        }
    }

    if (submitState === "success") {
        return (
            <div
                className="border border-blue-400/25 bg-blue-500/10 p-6"
                style={{ borderRadius: 8 }}
            >
                <h2 className="text-2xl font-semibold text-white">Submission received</h2>

                <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Thank you. Your game has been submitted for FRDA review. If approved, it
                    will appear in the public Game Directory.
                </p>

                <a
                    href="/games"
                    className="mt-6 inline-flex border border-blue-400/30 bg-blue-500/15 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                    style={{ borderRadius: 5 }}
                >
                    Back to Game Directory
                </a>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            <div
                className="border border-blue-400/25 bg-blue-500/10 p-5"
                style={{ borderRadius: 8 }}
            >
                <p className="text-sm leading-7 text-zinc-300">
                    Game submissions are currently open to accepted FRDA developers aged
                    18 and above. Please use the FRDA Member ID and email address from your
                    approval email. If you are not registered yet, please{" "}
                    <a
                        href="/apply"
                        className="font-medium text-blue-300 underline underline-offset-4 hover:text-blue-200"
                    >
                        apply as a developer first
                    </a>
                    .
                </p>
            </div>
            <input
                type="text"
                name="companyWebsite"
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
            />

            {errorMsg ? (
                <div
                    className="border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                    style={{ borderRadius: 5 }}
                >
                    {errorMsg}
                </div>
            ) : null}

            <div
                className="border border-zinc-800 bg-zinc-950/35 p-5"
                style={{ borderRadius: 8 }}
            >
                <h2 className="text-base font-semibold text-white">Member Details</h2>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                        <FieldLabel>FRDA Member ID</FieldLabel>
                        <TextInput
                            name="memberId"
                            value={memberId}
                            onChange={setMemberId}
                            placeholder="Example: FRDA-M-L37MJ2JN"
                            required
                        />
                    </div>

                    <div>
                        <FieldLabel>Contact Email</FieldLabel>
                        <TextInput
                            name="contactEmail"
                            type="email"
                            value={contactEmail}
                            onChange={setContactEmail}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                </div>
            </div>

            <div
                className="border border-zinc-800 bg-zinc-950/35 p-5"
                style={{ borderRadius: 8 }}
            >
                <h2 className="text-base font-semibold text-white">Game Details</h2>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                        <FieldLabel>Game Title</FieldLabel>
                        <TextInput
                            name="title"
                            value={title}
                            onChange={setTitle}
                            placeholder="Example: Shadow City"
                            required
                        />
                    </div>

                    <div>
                        <FieldLabel>Developer / Group Name</FieldLabel>
                        <TextInput
                            name="creatorName"
                            value={creatorName}
                            onChange={setCreatorName}
                            placeholder="Creator name or Roblox group"
                            required
                        />
                    </div>
                </div>

                <div className="mt-5">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                        name="description"
                        value={description}
                        onChange={(event) =>
                            setDescription(event.target.value.slice(0, DESCRIPTION_LIMIT))
                        }
                        rows={5}
                        placeholder="Write a short public-facing description of your game."
                        required
                        className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                        style={{ borderRadius: 5 }}
                    />
                    <p className="mt-2 text-right text-xs text-zinc-500">
                        {description.length}/{DESCRIPTION_LIMIT}
                    </p>
                </div>

                <div className="mt-5">
                    <FieldLabel>Roblox Game Link</FieldLabel>
                    <TextInput
                        name="robloxUrl"
                        value={robloxUrl}
                        onChange={setRobloxUrl}
                        placeholder="https://www.roblox.com/games/..."
                        required
                    />
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <div>
                        <FieldLabel>Creator Type</FieldLabel>
                        <select
                            name="creatorType"
                            value={creatorType}
                            onChange={(event) =>
                                setCreatorType(event.target.value === "group" ? "group" : "individual")
                            }
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            style={{ borderRadius: 5 }}
                        >
                            <option value="individual">Individual</option>
                            <option value="group">Group</option>
                        </select>
                    </div>

                    <div>
                        <FieldLabel>Genre</FieldLabel>
                        <select
                            name="genre"
                            value={genre}
                            onChange={(event) => setGenre(event.target.value)}
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            style={{ borderRadius: 5 }}
                        >
                            {GAME_GENRE_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <FieldLabel>Content Maturity</FieldLabel>
                        <select
                            name="contentMaturity"
                            value={contentMaturity}
                            onChange={(event) => setContentMaturity(event.target.value)}
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            style={{ borderRadius: 5 }}
                        >
                            {GAME_CONTENT_MATURITY_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div
                className="border border-zinc-800 bg-zinc-950/35 p-5"
                style={{ borderRadius: 8 }}
            >
                <h2 className="text-base font-semibold text-white">Game Thumbnail</h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Please upload a clear thumbnail image for your listing. This is required
                    because it appears on the public game card.
                </p>

                <div className="mt-5 max-w-xl">
                    <FileInput
                        label="Thumbnail Image Required"
                        helper="Recommended size: 1280 × 720 px. Used on public game cards."
                        file={thumbnailFile}
                        previewUrl={thumbnailPreviewUrl}
                        onChange={setThumbnailFile}
                    />
                </div>
            </div>

            <div
                className="border border-zinc-800 bg-zinc-950/35 p-5"
                style={{ borderRadius: 8 }}
            >
                <p className="text-sm leading-7 text-zinc-400">
                    By submitting, you confirm that this Roblox experience is yours or that
                    you are authorized to submit it for review. FRDA may decline listings
                    that appear unsafe, misleading, incomplete, or not aligned with the
                    directory’s purpose.
                </p>

                <button
                    type="submit"
                    disabled={submitState === "submitting"}
                    className="mt-5 inline-flex w-full cursor-pointer items-center justify-center border border-blue-400/30 bg-blue-500/15 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    style={{ borderRadius: 5 }}
                >
                    {submitState === "submitting" ? "Submitting..." : "Submit Game for Review"}
                </button>
            </div>
        </form>
    );
}