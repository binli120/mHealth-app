/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/seo/site-url"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/application/",
          "/auth/",
          "/customer/",
          "/notifications/",
          "/reviewer/",
          "/setup-mfa/",
          "/social-worker/",
          "/upload/",
          "/verify/",
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
