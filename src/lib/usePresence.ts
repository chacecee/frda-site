"use client";

import { useEffect, useRef } from "react";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";
import type { User } from "firebase/auth";
import { rtdb } from "@/lib/firebase";

function normalizePresenceKey(email?: string | null) {
  return (email || "").trim().toLowerCase().replaceAll(".", ",");
}

export function usePresence(user: User | null) {
  const previousEmailRef = useRef<string | null>(null);

  useEffect(() => {
    const previousEmail = previousEmailRef.current;
    const currentEmail = user?.email?.trim().toLowerCase() || null;

    async function markOffline(email: string) {
      const key = normalizePresenceKey(email);
      if (!key) return;

      const statusRef = ref(rtdb, `status/${key}`);

      try {
        await set(statusRef, {
          state: "offline",
          lastChanged: serverTimestamp(),
          email,
        });
      } catch (error) {
        console.error("Failed to mark offline:", error);
      }
    }

    if (!currentEmail) {
      if (previousEmail) {
        void markOffline(previousEmail);
        previousEmailRef.current = null;
      }
      return;
    }

    previousEmailRef.current = currentEmail;

    const key = normalizePresenceKey(currentEmail);
    const connectedRef = ref(rtdb, ".info/connected");
    const statusRef = ref(rtdb, `status/${key}`);

    const unsubscribe = onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true) return;

      try {
        await onDisconnect(statusRef).set({
          state: "offline",
          lastChanged: serverTimestamp(),
          email: currentEmail,
        });

        await set(statusRef, {
          state: "online",
          lastChanged: serverTimestamp(),
          email: currentEmail,
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    });

    return () => {
      unsubscribe();
      void markOffline(currentEmail);
    };
  }, [user]);
}