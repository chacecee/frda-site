"use client";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  useEffect,
  useState,
} from "react";

import { auth } from "@/lib/firebase";

export function useAuthUser() {
  const [user, setUser] =
    useState<User | null>(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {
          setUser(currentUser);
          setAuthLoading(false);
        },
      );

    return unsubscribe;
  }, []);

  return {
    user,
    authLoading,
  };
}