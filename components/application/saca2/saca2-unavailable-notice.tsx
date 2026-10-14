/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MASSHEALTH_PHONE } from "@/lib/masshealth/constants"

const OFFICIAL_APPLICATIONS_URL = "https://www.mass.gov/lists/applications-to-become-a-masshealth-member"

export function Saca2UnavailableNotice() {
  return (
    <section
      data-testid="saca2-unavailable"
      className="space-y-3 rounded-lg border bg-card p-6 text-card-foreground"
      aria-labelledby="saca2-unavailable-title"
    >
      <h2 id="saca2-unavailable-title" className="text-lg font-semibold">
        Online SACA-2 is not available yet
      </h2>
      <p className="text-sm text-muted-foreground">
        The application for seniors and people needing long-term-care services (SACA-2) is not
        yet available in this app. We have not started the standard ACA-3 form for you, because
        it is a different application.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          Download the official SACA-2 from{" "}
          <a
            className="underline"
            href={OFFICIAL_APPLICATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            mass.gov
          </a>
          .
        </li>
        <li>Or call MassHealth at {MASSHEALTH_PHONE} (TTY 711) to apply by phone.</li>
      </ul>
    </section>
  )
}
