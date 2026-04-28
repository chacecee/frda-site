import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/apply/status",
          "/apply/status/",
          "/apply/submitted",
          "/apply/submitted/",
          "/apply/track",
        ],
      },
    ],
    sitemap: "https://frdaph.org/sitemap.xml",
  };
}