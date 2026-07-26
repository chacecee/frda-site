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

export async function setPresenceOffline(
  uid?: string | null,
  email?: string | null,
) {
  const normalizedUid = uid?.trim() || "";
  const normalizedEmail =
    email?.trim().toLowerCase() || "";

  if (!normalizedUid || !normalizedEmail) {
    return;
  }

  const statusRef = ref(
    rtdb,
    `status/${normalizedUid}`,
  );

  await set(statusRef, {
    state: "offline",
    lastChanged: serverTimestamp(),
    email: normalizedEmail,
  });
}

export function usePresence(
  user: User | null,
) {
  useEffect(() => {
    if (!user?.uid || !user.email) {
      return;
    }

    const normalizedEmail =
      user.email.trim().toLowerCase();

    const connectedRef = ref(
      rtdb,
      ".info/connected",
    );

    const statusRef = ref(
      rtdb,
      `status/${user.uid}`,
    );

    const unsubscribe = onValue(
      connectedRef,
      async (snapshot) => {
        if (snapshot.val() !== true) {
          return;
        }

        try {
          await onDisconnect(
            statusRef,
          ).set({
            state: "offline",
            lastChanged:
              serverTimestamp(),
            email: normalizedEmail,
          });

          await set(statusRef, {
            state: "online",
            lastChanged:
              serverTimestamp(),
            email: normalizedEmail,
          });
        } catch (error) {
          console.error(
            "Failed to update presence:",
            error,
          );
        }
      },
    );

    return unsubscribe;
  }, [user]);
}