/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import ApplicationTypePageClient from "./application-type-page-client"

interface ApplicationTypePageProps {
  searchParams?: Promise<{
    recommended?: string | string[]
  }>
}

export default async function ApplicationTypePage({ searchParams }: ApplicationTypePageProps) {
  const params = await searchParams
  const recommended = Array.isArray(params?.recommended)
    ? params?.recommended[0]
    : params?.recommended

  return <ApplicationTypePageClient recommendedParam={recommended ?? null} />
}
