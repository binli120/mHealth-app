/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import "server-only"

import { redirect } from "next/navigation"

import { requireReviewerFromHeaders } from "@/lib/auth/require-reviewer"

export async function requireReviewerPage(next: string) {
  const authResult = await requireReviewerFromHeaders(next)
  if (authResult.ok) {
    return authResult
  }

  if (authResult.response.status === 401) {
    redirect(`/auth/login?next=${encodeURIComponent(next)}`)
  }

  redirect("/customer/dashboard")
}
