/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * /mobile/[token] — server component, renders MobileShell client component.
 * No auth — token is the credential.
 */
import { MobileShell } from "./shell"

interface PageProps { params: Promise<{ token: string }> }

export default async function MobileHandoffPage({ params }: PageProps) {
  const { token } = await params
  return <MobileShell token={token} />
}
