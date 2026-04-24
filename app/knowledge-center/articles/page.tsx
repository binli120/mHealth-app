/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppSelector } from "@/lib/redux/hooks"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { ShieldHeartIcon } from "@/lib/icons"
import {
  getArticlePreviewImageUrl,
  getArticleUrlForLanguage,
  getKnowledgeCenterCopy,
  KNOWLEDGE_ARTICLES,
} from "@/lib/masshealth/knowledge-center"

export default function KnowledgeCenterArticlesPage() {
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const copy = getKnowledgeCenterCopy(selectedLanguage)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link
            href="/knowledge-center"
            className="flex flex-1 items-center gap-2 text-muted-foreground hover:text-foreground"
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
          <div className="flex flex-1 justify-end">
            <LanguageSwitcher className="w-[190px] border-border bg-card text-foreground" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
          <Newspaper className="h-6 w-6 text-primary" />
          {copy.sectionArticles}
        </h1>

        {selectedLanguage !== "en" ? (
          <p className="text-sm text-muted-foreground">{copy.translatedViaGoogle}</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {KNOWLEDGE_ARTICLES.map((article) => {
            const articleUrl = getArticleUrlForLanguage(article, selectedLanguage)
            return (
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
                    <a href={articleUrl} target="_blank" rel="noreferrer">
                      {copy.openArticle}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
