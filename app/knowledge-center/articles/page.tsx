"use client"

import { useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react"

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
  KNOWLEDGE_ARTICLES,
} from "@/lib/masshealth/knowledge-center"

export default function KnowledgeCenterArticlesPage() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const copy = getKnowledgeCenterCopy(selectedLanguage)

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
            <span className="font-semibold text-foreground">MassHealth</span>
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

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
          <Newspaper className="h-6 w-6 text-primary" />
          {copy.sectionArticles}
        </h1>

        <div className="grid gap-4 md:grid-cols-2">
          {KNOWLEDGE_ARTICLES.map((article) => (
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
      </main>
    </div>
  )
}
