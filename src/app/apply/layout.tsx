import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import PageViewTracker from "@/components/analytics/PageViewTracker";

export const metadata: Metadata = {
  title: "FRDA Developer Directory",
  description:
    "FRDA's old developer application system has moved to the member portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ApplyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#04163a]">
      <PageViewTracker />
      <SiteHeader />
      {children}
    </div>
  );
}