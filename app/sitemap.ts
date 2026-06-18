/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/seo/site-url"
import { PROGRAM_PAGES } from "./programs/program-content"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/prescreener`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/programs`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/knowledge-center`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/knowledge-center/articles`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/knowledge-center/videos`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/masshealth-appeals`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/benefit-stack`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ]

  const programPages: MetadataRoute.Sitemap = PROGRAM_PAGES.map((program) => ({
    url: `${base}/programs/${program.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }))

  return [...staticPages, ...programPages]
}
