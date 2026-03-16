"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  /** Back link destination and label */
  backHref: string
  backLabel?: string
  /** Breadcrumb trail — last item is the current page (no href needed) */
  breadcrumbs: BreadcrumbItem[]
  /** Optional right-side content (e.g. a reset button) */
  actions?: ReactNode
  /** Max-width container class. Defaults to "max-w-4xl" */
  maxWidth?: string
}

/**
 * Reusable subpage header with back navigation and breadcrumb trail.
 * Used by benefit-stack, appeal-assistant, and similar tool pages.
 */
export function PageHeader({
  backHref,
  backLabel = "Dashboard",
  breadcrumbs,
  actions,
  maxWidth = "max-w-4xl",
}: PageHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-4 py-4">
      <div className={`mx-auto ${maxWidth} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-gray-300">/</span>
              {crumb.href ? (
                <Link href={crumb.href} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </header>
  )
}
