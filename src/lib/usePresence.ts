"use client";

import { useEffect } from "react";
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

export async function setPresenceOffline(email?: string | null) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const key = normalizePresenceKey(normalizedEmail);
  if (!key || !normalizedEmail) return;

  const statusRef = ref(rtdb, `status/${key}`);

  await set(statusRef, {
    state: "offline",
    lastChanged: serverTimestamp(),
    email: normalizedEmail,
  });
}

export function usePresence(user: User | null) {
  useEffect(() => {
    if (!user?.email) return;

    const normalizedEmail = user.email.trim().toLowerCase();
    const key = normalizePresenceKey(normalizedEmail);
    if (!key) return;

    const connectedRef = ref(rtdb, ".info/connected");
    const statusRef = ref(rtdb, `status/${key}`);

    const unsubscribe = onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true) return;

      try {
        await onDisconnect(statusRef).set({
          state: "offline",
          lastChanged: serverTimestamp(),
          email: normalizedEmail,
        });

        await set(statusRef, {
          state: "online",
          lastChanged: serverTimestamp(),
          email: normalizedEmail,
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);
}