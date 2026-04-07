import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FRDA Staff Portal",
  description: "Admin area for FRDA staff and application review.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}