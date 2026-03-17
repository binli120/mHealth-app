"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, BookOpenText, ChevronDown, ChevronUp, Download, ExternalLink, FileText, Newspaper, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import { ShieldHeartIcon } from "@/lib/icons"
import {
  getArticlePreviewImageUrl,
  getKnowledgeCenterCopy,
  getVideosForLanguage,
  getYouTubeThumbnailUrl,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_DOCUMENTS,
} from "@/lib/masshealth/knowledge-center"

const VIDEO_PREVIEW_COUNT = 6
const ARTICLE_PREVIEW_COUNT = 4

export default function KnowledgeCenterPage() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const copy = getKnowledgeCenterCopy(selectedLanguage)

  const [videosExpanded, setVideosExpanded] = useState(false)
  const [articlesExpanded, setArticlesExpanded] = useState(false)

  const allVideos = useMemo(() => getVideosForLanguage(selectedLanguage), [selectedLanguage])
  const allArticles = useMemo(() => KNOWLEDGE_ARTICLES, [])

  const videos = videosExpanded ? allVideos : allVideos.slice(0, VIDEO_PREVIEW_COUNT)
  const articles = articlesExpanded ? allArticles : allArticles.slice(0, ARTICLE_PREVIEW_COUNT)

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) {
      dispatch(setLanguage(value))
    }
  }

  useEffect(() => {
    document.documentElement.lang = selectedLanguage
  }, [selectedLanguage])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/customer/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[190px] border-border bg-card text-foreground">
              <SelectValue placeholder={copy.languageLabel} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpenText className="h-3.5 w-3.5" />
            {copy.officialMassGov}
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{copy.pageTitle}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{copy.pageDescription}</p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Video className="h-5 w-5 text-primary" />
              {copy.sectionVideos}
              <span className="text-sm font-normal text-muted-foreground">({allVideos.length})</span>
            </h2>
            <Link href="/knowledge-center/videos">
              <Button variant="outline" size="sm">
                {copy.viewMore}
              </Button>
            </Link>
          </div>

          {selectedLanguage !== "en" ? (
            <p className="text-xs text-muted-foreground">{copy.showingEnglish}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden border-border bg-card">
                <Image
                  src={getYouTubeThumbnailUrl(video.youtubeId)}
                  alt={video.title}
                  width={480}
                  height={270}
                  className="h-44 w-full object-cover"
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{video.title}</CardTitle>
                  <CardDescription>{video.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 pt-0">
                  <Button asChild size="sm">
                    <a href={video.youtubeUrl} target="_blank" rel="noreferrer">
                      {copy.openOnYoutube}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={video.sourceUrl} target="_blank" rel="noreferrer">
                      {copy.sourcePage}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {allVideos.length > VIDEO_PREVIEW_COUNT && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVideosExpanded((v) => !v)}
                className="gap-2"
              >
                {videosExpanded ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show {allVideos.length - VIDEO_PREVIEW_COUNT} more videos <ChevronDown className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Newspaper className="h-5 w-5 text-primary" />
              {copy.sectionArticles}
              <span className="text-sm font-normal text-muted-foreground">({allArticles.length})</span>
            </h2>
            <Link href="/knowledge-center/articles">
              <Button variant="outline" size="sm">
                {copy.viewMore}
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <Card key={article.id} className="overflow-hidden border-border bg-card">
                <Image
                  src={getArticlePreviewImageUrl(article.url)}
                  alt={article.title}
                  width={900}
                  height={320}
                  className="h-44 w-full object-cover"
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{article.title}</CardTitle>
                  <CardDescription>{article.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild size="sm" variant="outline">
                    <a href={article.url} target="_blank" rel="noreferrer">
                      {copy.openArticle}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {allArticles.length > ARTICLE_PREVIEW_COUNT && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArticlesExpanded((v) => !v)}
                className="gap-2"
              >
                {articlesExpanded ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show {allArticles.length - ARTICLE_PREVIEW_COUNT} more articles <ChevronDown className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            {copy.sectionDocuments}
          </h2>

          <div className="grid gap-3">
            {KNOWLEDGE_DOCUMENTS.map((document) => (
              <Card key={document.id} className="border-border bg-card">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-card-foreground">{document.title}</p>
                    <p className="text-sm text-muted-foreground">{document.description}</p>
                  </div>
                  <Button asChild size="icon" variant="outline" aria-label={`Download ${document.title}`}>
                    <a href={document.url} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
