"use client";

import SubmitGameForm from "@/components/games/SubmitGameForm";

export default function SubmitGameModal({
    onClose,
}: {
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4">
            <div className="flex min-h-full items-start justify-center py-8">
                <div
                    className="w-full max-w-2xl border border-zinc-800 bg-zinc-900 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
                    style={{ borderRadius: 10 }}
                >
                    <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 px-6 py-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    Submit a Roblox experience for directory review
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-2xl leading-none text-zinc-400 transition hover:text-white"
                                aria-label="Close submit game form"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[calc(100vh-150px)] overflow-y-auto px-6 py-6">
                        <SubmitGameForm />
                    </div>
                </div>
            </div>
        </div>
    );
}