import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "FRDA Registration",
  description:
    "Apply to become a verified member of the Filipino Roblox Developers Association.",
};

export default function ApplyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#04163a]">
      <SiteHeader />
      {children}
    </div>
  );
}