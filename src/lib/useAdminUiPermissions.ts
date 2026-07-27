"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  onAuthStateChanged,
} from "firebase/auth";
import {
  auth,
} from "@/lib/firebase";
import type {
  SidebarPermissionMap,
} from "@/lib/adminPermissions";

export function useAdminUiPermissions() {
  const [
    permissionMap,
    setPermissionMap,
  ] = useState<SidebarPermissionMap>({});

  const [
    permissionsLoading,
    setPermissionsLoading,
  ] = useState(true);

  const [
    permissionsError,
    setPermissionsError,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            if (!cancelled) {
              setPermissionMap({});
              setPermissionsError("");
              setPermissionsLoading(false);
            }
            return;
          }

          if (!cancelled) {
            setPermissionsLoading(true);
            setPermissionsError("");
          }

          try {
            const idToken =
              await user.getIdToken();

            const response =
              await fetch(
                "/api/admin/sidebar",
                {
                  headers: {
                    Authorization:
                      `Bearer ${idToken}`,
                  },
                  cache: "no-store",
                },
              );

            const result =
              await response
                .json()
                .catch(() => null);

            if (
              !response.ok ||
              !result?.ok
            ) {
              throw new Error(
                result?.error ||
                "Could not verify your page permissions.",
              );
            }

            if (!cancelled) {
              setPermissionMap(
                result.permissions &&
                typeof result.permissions ===
                  "object"
                  ? result.permissions as SidebarPermissionMap
                  : {},
              );
            }
          } catch (error) {
            console.error(
              "Error loading admin UI permissions:",
              error,
            );

            if (!cancelled) {
              setPermissionsError(
                error instanceof Error
                  ? error.message
                  : "Could not verify your page permissions.",
              );
              setPermissionMap({});
            }
          } finally {
            if (!cancelled) {
              setPermissionsLoading(false);
            }
          }
        },
      );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return {
    permissionMap,
    permissionsLoading,
    permissionsError,
  };
}