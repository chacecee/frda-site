"use client";

import {
  AnimatePresence,
  motion,
} from "framer-motion";
import { X } from "lucide-react";
import SubmitGameForm from "@/components/games/SubmitGameForm";

export default function MemberSubmitGameModal({
  open,
  displayName,
  onClose,
  onSuccess,
}: {
  open: boolean;
  displayName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[170] overflow-y-auto bg-black/78 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              onClose();
            }
          }}
        >
          <div className="flex min-h-full items-start justify-center py-8">
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
              className="w-full max-w-2xl overflow-hidden border border-sky-300/15 bg-[#081426]/98 shadow-[0_0_48px_rgba(37,99,235,0.16),0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{ borderRadius: 10 }}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#081426]/96 px-6 py-5 backdrop-blur-xl">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
                    Game Directory
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Submit Your Game
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Your FRDA Member ID and email are linked automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center text-zinc-400 transition hover:text-white"
                  aria-label="Close game submission"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-150px)] overflow-y-auto px-6 py-6">
                <SubmitGameForm
                  memberMode
                  defaultCreatorName={displayName}
                  onSuccess={onSuccess}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}