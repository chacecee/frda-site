"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser?.email) return;

      try {
        const signedInEmail = normalizeEmail(currentUser.email);

        const staffQuery = query(
          collection(db, "staff"),
          where("emailAddress", "==", currentUser.email)
        );

        let snapshot = await getDocs(staffQuery);

        if (snapshot.empty) {
          const allStaffSnapshot = await getDocs(collection(db, "staff"));
          const match = allStaffSnapshot.docs.find((docSnap) => {
            const data = docSnap.data() as { emailAddress?: string; status?: string };
            return normalizeEmail(data.emailAddress) === signedInEmail;
          });

          if (!match) return;

          const data = match.data() as { status?: string; dateJoined?: unknown };

          if (data.status !== "Invited") return;

          await updateDoc(match.ref, {
            status: "Active",
            updatedAt: serverTimestamp(),
            ...(data.dateJoined ? {} : { dateJoined: serverTimestamp() }),
          });

          return;
        }

        const matchDoc = snapshot.docs[0];
        const matchData = matchDoc.data() as { status?: string; dateJoined?: unknown };

        if (matchData.status !== "Invited") return;

        await updateDoc(matchDoc.ref, {
          status: "Active",
          updatedAt: serverTimestamp(),
          ...(matchData.dateJoined ? {} : { dateJoined: serverTimestamp() }),
        });
      } catch (error) {
        console.error("Error auto-activating signed-in staff member:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, authLoading };
}