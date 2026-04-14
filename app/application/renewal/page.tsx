/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RenewalApplicationPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Renewal Applications</CardTitle>
          <CardDescription>
            Renewal routing is temporarily consolidated under the standard application flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/application/type">
            <Button>Start Renewal</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
