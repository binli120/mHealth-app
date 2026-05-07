import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DsrCta() {
  return (
    <div className="dsr-cta rounded-lg border border-primary/20 bg-primary/5 p-4 sm:p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">
              Exercise your data rights
            </p>
            <p className="text-sm text-muted-foreground">
              Submit a privacy request or ask a question about your data.
            </p>
          </div>
        </div>
        <Link href="/privacy/requests">
          <Button variant="outline" size="sm" className="shrink-0">
            Submit a request
          </Button>
        </Link>
      </div>
    </div>
  )
}
