import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import PageViewTracker from "@/components/analytics/PageViewTracker";

const SITE_URL = "https://frdaph.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FRDA",
    template: "%s | FRDA",
  },
  description:
    "FRDA supports Filipino Roblox developers through representation, standards, and community initiatives.",
  openGraph: {
    type: "website",
    siteName: "FRDA",
    url: SITE_URL,
    title: "FRDA",
    description:
      "FRDA supports Filipino Roblox developers through representation, standards, and community initiatives.",
    images: [
      {
        url: "/frda-logo.png",
        alt: "FRDA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FRDA",
    description:
      "FRDA supports Filipino Roblox developers through representation, standards, and community initiatives.",
    images: ["/frda-logo.png"],
  },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#04163a] text-white">
      <PageViewTracker />

      <div className="relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(24,119,255,0.16),transparent_32%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(0,194,255,0.08),transparent_22%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(44,107,255,0.12),transparent_26%)]" />

          <div className="absolute left-[-180px] top-24 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-[-140px] top-28 h-[380px] w-[380px] rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute left-1/2 top-[420px] h-[260px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,#03112f_0%,#04163a_28%,#04163a_100%)]" />
        </div>

        <div className="relative z-10">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}