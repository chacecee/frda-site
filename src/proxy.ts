import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAIN_DOMAIN = "frdaph.org";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "portal",
  "api",
  "mail",
  "email",
  "support",
  "help",
  "contact",
  "about",
  "blog",
  "news",
  "games",
  "game",
  "developers",
  "developer",
  "opportunities",
  "opportunity",
  "member",
  "members",
  "staff",
  "login",
  "register",
  "signup",
  "survey",
  "privacy",
  "terms",
  "status",
  "discord",
  "cdn",
  "assets",
  "static",
  "files",
  "images",
  "media",
  "app",
  "dashboard",
  "account",
  "accounts",
  "billing",
  "payments",
  "security",
  "root",
  "system",
  "localhost",
]);

function getHostname(request: NextRequest): string {
  const directHost =
    request.headers.get("host") || "";

  const forwardedHost =
    request.headers.get("x-forwarded-host") || "";

  const host =
    directHost || forwardedHost;

  return host
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

function getDeveloperSubdomain(
  hostname: string
): string {
  if (!hostname) return "";

  if (
    hostname === MAIN_DOMAIN ||
    hostname === `www.${MAIN_DOMAIN}`
  ) {
    return "";
  }

  if (hostname.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = hostname.slice(
      0,
      -`.${MAIN_DOMAIN}`.length
    );

    if (
      !subdomain ||
      subdomain.includes(".") ||
      RESERVED_SUBDOMAINS.has(subdomain)
    ) {
      return "";
    }

    return subdomain;
  }

  if (hostname.endsWith(".localhost")) {
    const subdomain = hostname.slice(
      0,
      -".localhost".length
    );

    if (
      !subdomain ||
      subdomain.includes(".") ||
      RESERVED_SUBDOMAINS.has(subdomain)
    ) {
      return "";
    }

    return subdomain;
  }

  return "";
}

export function proxy(
  request: NextRequest
) {
  const hostname = getHostname(request);
  const pathname = request.nextUrl.pathname;

  if (
    hostname === `portal.${MAIN_DOMAIN}` &&
    pathname === "/"
  ) {
    const url = request.nextUrl.clone();

    url.pathname = "/admin/login";

    return NextResponse.rewrite(url);
  }

  const developerSubdomain =
    getDeveloperSubdomain(hostname);

  if (
    developerSubdomain &&
    pathname === "/"
  ) {
    const url = request.nextUrl.clone();

    url.pathname =
      `/developers/${encodeURIComponent(
        developerSubdomain
      )}`;

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};