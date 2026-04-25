"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logAnalyticsEvent } from "@/lib/analytics";

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    if (lastLoggedPath.current === pathname) return;

    lastLoggedPath.current = pathname;

    logAnalyticsEvent({
      eventName: "page_view",
      path: pathname,
      metadata: {
        url: window.location.href,
      },
    });
  }, [pathname]);

  return null;
}