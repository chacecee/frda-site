"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SidebarPermissionMap } from "@/lib/adminPermissions";

export function useAdminUiPermissions() {
    const [permissionMap, setPermissionMap] = useState<SidebarPermissionMap>({});
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [permissionsError, setPermissionsError] = useState("");

    useEffect(() => {
        const permissionsRef = doc(db, "adminUiPermissions", "sidebar");

        const unsubscribe = onSnapshot(
            permissionsRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setPermissionMap({});
                    setPermissionsLoading(false);
                    return;
                }

                setPermissionMap(snapshot.data() as SidebarPermissionMap);
                setPermissionsLoading(false);
            },
            (error) => {
                console.error("Error loading admin UI permissions:", error);
                setPermissionsError("Could not verify your page permissions.");
                setPermissionMap({});
                setPermissionsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return {
        permissionMap,
        permissionsLoading,
        permissionsError,
    };
}