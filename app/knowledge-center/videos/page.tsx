"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ExternalLink, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppSelector } from "@/lib/redux/hooks"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { getKnowledgeCenterCopy, getVideosForLanguage, getYouTubeThumbnailUrl } from "@/lib/masshealth/knowledge-center"
import { ShieldHeartIcon } from "@/lib/icons"

export default function KnowledgeCenterVideosPage() {
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const copy = getKnowledgeCenterCopy(selectedLanguage)
  const videos = useMemo(() => getVideosForLanguage(selectedLanguage), [selectedLanguage])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/knowledge-center"
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
          <LanguageSwitcher className="w-[190px] border-border bg-card text-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
          <Video className="h-6 w-6 text-primary" />
          {copy.sectionVideos}
        </h1>
        {selectedLanguage !== "en" ? (
          <p className="text-sm text-muted-foreground">{copy.showingEnglish}</p>
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
      </main>
    </div>
  )
}
