import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FRDA Registration",
  description:
    "Apply to become a verified member of the Filipino Roblox Developers Association.",
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}