"use client";

import { useEffect } from "react";
import { ref, onValue, onDisconnect, serverTimestamp, set } from "firebase/database";
import { User } from "firebase/auth";
import { rtdb } from "@/lib/firebase";

function normalizePresenceKey(email?: string | null) {
  return (email || "").trim().toLowerCase().replaceAll(".", ",");
}

export function usePresence(user: User | null) {
  useEffect(() => {
    if (!user?.email) return;

    const key = normalizePresenceKey(user.email);
    if (!key) return;

    const connectedRef = ref(rtdb, ".info/connected");
    const statusRef = ref(rtdb, `status/${key}`);

    const unsubscribe = onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true) return;

      await onDisconnect(statusRef).set({
        state: "offline",
        lastChanged: serverTimestamp(),
        email: user.email,
      });

      await set(statusRef, {
        state: "online",
        lastChanged: serverTimestamp(),
        email: user.email,
      });
    });

    return () => unsubscribe();
  }, [user]);
}