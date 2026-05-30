/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FileText, Mail, Send, ShieldCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "Data Subject Requests",
  description:
    "Submit a privacy request to HealthCompass — access, amendment, or other data rights.",
}

const PRIVACY_EMAIL = "privacy@healthcompass.cloud"
const PRIVACY_MAILTO = `mailto:${PRIVACY_EMAIL}?subject=HealthCompass privacy request`

export default function PrivacyRequestsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Privacy Statement
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Data Subject Requests
          </h1>
          <p className="mb-8 text-muted-foreground">
            Use this page to exercise your privacy rights under HIPAA and
            Massachusetts law.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            "Access my data",
            "Correct my data",
            "Delete or restrict use",
          ].map((label) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">{label}</p>
            </div>
          ))}
        </div>

        <form
          action={PRIVACY_MAILTO}
          method="post"
          encType="text/plain"
          className="mt-6 space-y-5 rounded-lg border border-border bg-card p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Full name
              <input
                name="fullName"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
                autoComplete="name"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Email
              <input
                name="email"
                type="email"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
                autoComplete="email"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Request type
            <select
              name="requestType"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
              defaultValue=""
            >
              <option value="" disabled>Select a request type</option>
              <option>Access a copy of my data</option>
              <option>Correct or amend my data</option>
              <option>Delete data where permitted</option>
              <option>Restrict or object to certain processing</option>
              <option>Ask a privacy or HIPAA question</option>
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Request details
            <textarea
              name="details"
              required
              rows={5}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground"
              placeholder="Tell us what records or action you are requesting. Do not include your SSN in this form."
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Preferred contact method
            <select
              name="preferredContact"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
              defaultValue="Email"
            >
              <option>Email</option>
              <option>Phone</option>
              <option>Secure message after sign-in</option>
            </select>
          </label>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            Requests are routed to the HealthCompass Privacy Office. Access and amendment requests are acknowledged within 30 days.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
              Submit privacy request
            </button>
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {PRIVACY_EMAIL}
            </a>
          </div>
        </form>
      </main>
    </div>
  )
}
