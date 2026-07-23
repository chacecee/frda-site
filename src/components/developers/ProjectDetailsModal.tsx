"use client";

import {
    useEffect,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import ProjectImageGallery, {
    type PublicProjectImage,
    type PublicProjectMedia,
} from "@/components/developers/ProjectImageGallery";

export type PublicProjectDetails = {
    id: string;
    title: string;
    projectUrl: string;
    youtubeVideoUrl: string;

    mediaOrder: Array<{
        type: "image" | "youtube";
        id: string;
    }>;

    role: string;
    contribution: string;
    teamName: string;

    projectType:
        | "owned"
        | "team"
        | "client"
        | "other";

    isInDevelopment: boolean;
    images: PublicProjectImage[];
};

type ProjectDetailsModalProps = {
    project: PublicProjectDetails | null;
    onProjectLinkClick?: (
        project: PublicProjectDetails
    ) => void;
    onClose: () => void;
};

function getProjectTypeLabel(
    value: PublicProjectDetails["projectType"]
): string {
    switch (value) {
        case "owned":
            return "Own project";

        case "team":
            return "Team project";

        case "client":
            return "Client work";

        default:
            return "Other project";
    }
}

function isRobloxGameUrl(
    value: string
): boolean {
    if (!value) return false;

    try {
        const url = new URL(value);

        return (
            url.hostname.endsWith(
                "roblox.com"
            ) &&
            url.pathname.startsWith(
                "/games/"
            )
        );
    } catch {
        return false;
    }
}

export default function ProjectDetailsModal({
    project,
    onProjectLinkClick,
    onClose,
}: ProjectDetailsModalProps) {
    useEffect(() => {
        if (!project) return;

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow =
            "hidden";

        function handleKeyDown(
            event: KeyboardEvent
        ) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.body.style.overflow =
                previousOverflow;

            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [project, onClose]);

    const orderedMedia:
        PublicProjectMedia[] = [];

    if (project) {
        const imageMap =
            new Map(
                project.images.map(
                    (image) => [
                        image.id,
                        image,
                    ]
                )
            );

        const used =
            new Set<string>();

        project.mediaOrder.forEach(
            (item) => {
                const key =
                    `${item.type}:${item.id}`;

                if (used.has(key)) {
                    return;
                }

                if (item.type === "image") {
                    const image =
                        imageMap.get(item.id);

                    if (!image) {
                        return;
                    }

                    orderedMedia.push({
                        type: "image",
                        id: image.id,
                        url: image.url,
                    });
                } else if (
                    item.type === "youtube" &&
                    project.youtubeVideoUrl
                ) {
                    orderedMedia.push({
                        type: "youtube",
                        id: "youtube",
                        url:
                            project.youtubeVideoUrl,
                    });
                }

                used.add(key);
            }
        );

        if (
            project.youtubeVideoUrl &&
            !used.has(
                "youtube:youtube"
            )
        ) {
            orderedMedia.push({
                type: "youtube",
                id: "youtube",
                url:
                    project.youtubeVideoUrl,
            });
        }

        project.images.forEach(
            (image) => {
                const key =
                    `image:${image.id}`;

                if (!used.has(key)) {
                    orderedMedia.push({
                        type: "image",
                        id: image.id,
                        url: image.url,
                    });
                }
            }
        );
    }

    return (
        <AnimatePresence>
            {project ? (
                <motion.div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            onClose();
                        }
                    }}
                >
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 18,
                            scale: 0.985,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: 12,
                            scale: 0.99,
                        }}
                        transition={{
                            duration: 0.22,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-sky-300/15 bg-[#081426]/98 shadow-[0_0_48px_rgba(37,99,235,0.16),0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                        style={{ borderRadius: 10 }}
                    >
                        <div className="flex items-start justify-between gap-5 border-b border-white/10 px-5 py-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-blue-300">
                                    Project Details
                                </p>

                                <h2 className="mt-1 text-xl font-semibold text-white">
                                    {project.title}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-2xl text-zinc-400 transition hover:text-white"
                                aria-label="Close project details"
                            >
                                ×
                            </button>
                        </div>

                        {orderedMedia.length > 0 ? (
                            <ProjectImageGallery
                                media={orderedMedia}
                                title={project.title}
                            />
                        ) : null}

                        <div className="p-6">
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className="border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-200"
                                    style={{ borderRadius: 999 }}
                                >
                                    {getProjectTypeLabel(
                                        project.projectType
                                    )}
                                </span>

                                {project.isInDevelopment ? (
                                    <span
                                        className="border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200"
                                        style={{
                                            borderRadius: 999,
                                        }}
                                    >
                                        In development
                                    </span>
                                ) : null}
                            </div>

                            <h3 className="mt-5 text-2xl font-semibold text-white">
                                {project.title}
                            </h3>

                            <p className="mt-3 text-sm font-medium text-zinc-200">
                                {project.role}
                            </p>

                            {project.teamName ? (
                                <p className="mt-1 text-sm text-zinc-500">
                                    Team or studio —{" "}
                                    {project.teamName}
                                </p>
                            ) : null}

                            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                {project.contribution}
                            </p>

                            {project.projectUrl ? (
                                <a
                                    href={project.projectUrl}
                                    onClick={() =>
                                        onProjectLinkClick?.(
                                            project
                                        )
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-7 inline-flex bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                                    style={{ borderRadius: 5 }}
                                >
                                    {isRobloxGameUrl(
                                        project.projectUrl
                                    )
                                        ? "Open on Roblox"
                                        : "Open Project"}
                                </a>
                            ) : null}
                        </div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}