"use client";

import { useEffect } from "react";
import { logAnalyticsEvent } from "@/lib/analytics";

export default function GamesVisitTracker() {
  useEffect(() => {
    logAnalyticsEvent({
      eventName: "game_directory_visit",
      path: "/games",
    });
  }, []);

  return null;
}