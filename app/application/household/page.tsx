/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HouseholdApplicationPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Household Member Updates</CardTitle>
          <CardDescription>
            Household updates are currently managed in the main application workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/application/type">
            <Button>Continue</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
