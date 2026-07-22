"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

type PublicSiteLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

function getResolvedHref(
  href: string
): string {
  const hostname =
    window.location.hostname.toLowerCase();

  const port = window.location.port
    ? `:${window.location.port}`
    : "";

  if (hostname.endsWith(".localhost")) {
    return `http://localhost${port}${href}`;
  }

  if (
    hostname.endsWith(".frdaph.org") &&
    hostname !== "frdaph.org" &&
    hostname !== "www.frdaph.org"
  ) {
    return `https://frdaph.org${href}`;
  }

  return href;
}

export default function PublicSiteLink({
  href,
  children,
  className,
}: PublicSiteLinkProps) {
  const [resolvedHref, setResolvedHref] =
    useState(href);

  useEffect(() => {
    setResolvedHref(getResolvedHref(href));
  }, [href]);

  return (
    <Link
      href={resolvedHref}
      className={className}
    >
      {children}
    </Link>
  );
}