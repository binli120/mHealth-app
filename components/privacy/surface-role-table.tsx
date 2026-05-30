/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { ShieldCheck, ShieldOff } from "lucide-react"

const surfaces = [
  {
    name: "Marketing site & public landing page",
    role: "Neither Covered Entity nor Business Associate",
    framework: "General privacy commitments and Massachusetts law",
    isBa: false,
  },
  {
    name: "Eligibility prescreener",
    role: "Neither Covered Entity nor Business Associate",
    framework: "Self-reported consumer data; not PHI. Governed by Massachusetts law",
    isBa: false,
  },
  {
    name: "MassHealth application assistance",
    role: "Business Associate",
    framework: "BAA with relevant Covered Entity governs the relationship",
    isBa: true,
  },
  {
    name: "Provider-facing portals",
    role: "Business Associate",
    framework: "BAA with relevant Covered Entity governs the relationship",
    isBa: true,
  },
  {
    name: "Any surface handling PHI from a Covered Entity",
    role: "Business Associate",
    framework: "Downstream BAAs bind subprocessors",
    isBa: true,
  },
] as const

export function SurfaceRoleTable() {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold">Surface</th>
            <th className="px-4 py-3 text-left font-semibold">HIPAA Role</th>
            <th className="px-4 py-3 text-left font-semibold">Governing Framework</th>
          </tr>
        </thead>
        <tbody>
          {surfaces.map((s) => (
            <tr key={s.name} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  {s.isBa ? (
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : (
                    <ShieldOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  {s.role}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{s.framework}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
