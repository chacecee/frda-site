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
          className="w-full max-w-4xl border border-zinc-800 bg-zinc-900 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
          style={{ borderRadius: 10 }}
        >
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
                  Submit Your Game
                </p>

                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Submit a Roblox experience for directory review
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  FRDA reviews submitted games before they appear in the public
                  Game Directory.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-zinc-700 bg-zinc-950 text-xl text-white transition hover:bg-zinc-800"
                style={{ borderRadius: 5 }}
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