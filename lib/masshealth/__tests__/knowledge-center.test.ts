import { describe, it, expect } from "vitest"

import {
  getKnowledgeCenterCopy,
  getYouTubeThumbnailUrl,
  getArticlePreviewImageUrl,
  getVideosForLanguage,
  KNOWLEDGE_VIDEOS,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_DOCUMENTS,
} from "@/lib/masshealth/knowledge-center"

describe("lib/masshealth/knowledge-center", () => {
  // ── getKnowledgeCenterCopy ──────────────────────────────────────────────────

  describe("getKnowledgeCenterCopy", () => {
    it("returns English copy for 'en'", () => {
      const copy = getKnowledgeCenterCopy("en")
      expect(copy.pageTitle).toBe("MassHealth Knowledge Center")
      expect(copy.sectionVideos).toBe("Videos")
      expect(copy.sectionArticles).toBe("Articles")
      expect(copy.sectionDocuments).toBe("Documents")
    })

    it("returns Spanish copy for 'es'", () => {
      const copy = getKnowledgeCenterCopy("es")
      expect(copy.pageTitle).toContain("MassHealth")
      expect(copy.sectionVideos).toBe("Videos")
      expect(copy.sectionArticles).toBe("Articulos")
    })

    it("returns Haitian Creole copy for 'ht'", () => {
      const copy = getKnowledgeCenterCopy("ht")
      expect(copy.sectionVideos).toBe("Videyo")
      expect(copy.sectionArticles).toBe("Atik")
    })

    it("returns Brazilian Portuguese copy for 'pt-BR'", () => {
      const copy = getKnowledgeCenterCopy("pt-BR")
      expect(copy.pageTitle).toContain("MassHealth")
      expect(copy.sectionDocuments).toBe("Documentos")
    })

    it("returns Vietnamese copy for 'vi'", () => {
      const copy = getKnowledgeCenterCopy("vi")
      expect(copy.sectionDocuments).toBe("Tai lieu")
    })

    it("returns Simplified Chinese copy for 'zh-CN'", () => {
      const copy = getKnowledgeCenterCopy("zh-CN")
      expect(copy.pageTitle).toContain("MassHealth")
      expect(copy.sectionVideos).toBe("视频")
    })

    it("falls back to English for an unsupported language code", () => {
      // @ts-expect-error intentionally testing fallback
      const copy = getKnowledgeCenterCopy("xx-XX")
      expect(copy.pageTitle).toBe("MassHealth Knowledge Center")
    })
  })

  // ── getYouTubeThumbnailUrl ─────────────────────────────────────────────────

  describe("getYouTubeThumbnailUrl", () => {
    it("returns the correct hqdefault thumbnail URL", () => {
      const url = getYouTubeThumbnailUrl("afD72HhNTFc")
      expect(url).toBe("https://img.youtube.com/vi/afD72HhNTFc/hqdefault.jpg")
    })

    it("embeds the video ID in the returned URL", () => {
      const videoId = "testVideoId123"
      const url = getYouTubeThumbnailUrl(videoId)
      expect(url).toContain(videoId)
      expect(url).toContain("img.youtube.com")
    })
  })

  // ── getArticlePreviewImageUrl ──────────────────────────────────────────────

  describe("getArticlePreviewImageUrl", () => {
    it("wraps the article URL in a thum.io preview URL", () => {
      const articleUrl = "https://www.mass.gov/some-article"
      const previewUrl = getArticlePreviewImageUrl(articleUrl)
      expect(previewUrl).toContain("thum.io")
      expect(previewUrl).toContain(articleUrl)
    })

    it("includes width/900 and noanimate in the URL", () => {
      const url = getArticlePreviewImageUrl("https://example.com/page")
      expect(url).toContain("width/900")
      expect(url).toContain("noanimate")
    })
  })

  // ── getVideosForLanguage ───────────────────────────────────────────────────

  describe("getVideosForLanguage", () => {
    it("returns English videos for 'en'", () => {
      const videos = getVideosForLanguage("en")
      expect(videos.length).toBeGreaterThan(0)
      videos.forEach((v) => expect(v.availableLanguages).toContain("en"))
    })

    it("returns a non-empty array for every supported language", () => {
      const languages = ["en", "es", "ht", "pt-BR", "vi", "zh-CN"] as const
      languages.forEach((lang) => {
        const videos = getVideosForLanguage(lang)
        expect(videos.length).toBeGreaterThan(0)
      })
    })

    it("falls back to all videos when no match for the requested language", () => {
      const allVideos = KNOWLEDGE_VIDEOS
      // @ts-expect-error intentionally testing fallback
      const fallback = getVideosForLanguage("xx-XX")
      expect(fallback.length).toBe(allVideos.length)
    })

    it("returns a subset (not more) of all videos", () => {
      const enVideos = getVideosForLanguage("en")
      expect(enVideos.length).toBeLessThanOrEqual(KNOWLEDGE_VIDEOS.length)
    })
  })

  // ── KNOWLEDGE_VIDEOS data shape ────────────────────────────────────────────

  describe("KNOWLEDGE_VIDEOS", () => {
    it("is a non-empty array", () => {
      expect(KNOWLEDGE_VIDEOS.length).toBeGreaterThan(0)
    })

    it("every entry has the required fields", () => {
      KNOWLEDGE_VIDEOS.forEach((v) => {
        expect(v.id).toBeTruthy()
        expect(v.title).toBeTruthy()
        expect(v.youtubeId).toBeTruthy()
        expect(v.youtubeUrl).toContain("youtube.com")
        expect(v.sourceUrl).toContain("mass.gov")
        expect(Array.isArray(v.availableLanguages)).toBe(true)
        expect(v.availableLanguages.length).toBeGreaterThan(0)
      })
    })

    it("all IDs are unique", () => {
      const ids = KNOWLEDGE_VIDEOS.map((v) => v.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  // ── KNOWLEDGE_ARTICLES data shape ─────────────────────────────────────────

  describe("KNOWLEDGE_ARTICLES", () => {
    it("is a non-empty array", () => {
      expect(KNOWLEDGE_ARTICLES.length).toBeGreaterThan(0)
    })

    it("every entry has the required fields", () => {
      KNOWLEDGE_ARTICLES.forEach((a) => {
        expect(a.id).toBeTruthy()
        expect(a.title).toBeTruthy()
        expect(a.description).toBeTruthy()
        expect(a.url).toContain("mass.gov")
      })
    })

    it("all IDs are unique", () => {
      const ids = KNOWLEDGE_ARTICLES.map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  // ── KNOWLEDGE_DOCUMENTS data shape ────────────────────────────────────────

  describe("KNOWLEDGE_DOCUMENTS", () => {
    it("is a non-empty array", () => {
      expect(KNOWLEDGE_DOCUMENTS.length).toBeGreaterThan(0)
    })

    it("every entry has the required fields", () => {
      KNOWLEDGE_DOCUMENTS.forEach((d) => {
        expect(d.id).toBeTruthy()
        expect(d.title).toBeTruthy()
        expect(d.description).toBeTruthy()
        expect(d.url).toContain("mass.gov")
      })
    })

    it("all IDs are unique", () => {
      const ids = KNOWLEDGE_DOCUMENTS.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
