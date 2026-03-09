"use client"

import { useSearchParams } from "next/navigation"
import { FormWizard } from "@/components/application/aca3/form-wizard"

export default function NewApplicationPage() {
  const searchParams = useSearchParams()
  const queryApplicationId = searchParams.get("applicationId")?.trim()

  return (
    <div className="container mx-auto px-4 py-6">
      <FormWizard applicationId={queryApplicationId || undefined} />
    </div>
  )
}
