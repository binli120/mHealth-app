interface Props {
  label: string
  value: string | null | undefined
  /** Render value with whitespace-pre-line (e.g. multi-line address) */
  multiline?: boolean
}

/**
 * A single read-only data row used in the view mode of profile sections.
 * Renders as a <dt>/<dd> pair inside a <dl> with divide-y styling.
 */
export function FieldRow({ label, value, multiline = false }: Props) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          value
            ? `text-sm text-foreground${multiline ? " whitespace-pre-line" : ""}`
            : "text-sm italic text-muted-foreground"
        }
      >
        {value ?? "Not set"}
      </dd>
    </div>
  )
}
