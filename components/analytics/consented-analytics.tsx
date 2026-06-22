/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import dynamic from "next/dynamic"

const GrowthProvider = dynamic(
  () => import("@/components/analytics/growth-provider").then((mod) => mod.GrowthProvider),
  { ssr: false },
)

const OpenObserveRumProvider = dynamic(
  () => import("@/components/analytics/openobserve-rum-provider").then((mod) => mod.OpenObserveRumProvider),
  { ssr: false },
)

const CustomerSessionProvider = dynamic(
  () => import("@/components/analytics/customer-session-provider").then((mod) => mod.CustomerSessionProvider),
  { ssr: false },
)

export function ConsentedAnalytics() {
  return (
    <>
      <GrowthProvider />
      <OpenObserveRumProvider />
      <CustomerSessionProvider />
    </>
  )
}
