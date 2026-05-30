/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { AnchorHTMLAttributes, HTMLAttributes } from "react"

function MdxH2({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 id={id} className="scroll-mt-24 group" {...props}>
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Link to ${typeof children === "string" ? children : "section"}`}
        >
          #
        </a>
      )}
    </h2>
  )
}

function MdxLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href?.startsWith("http")
  return (
    <a
      href={href}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      {...props}
    >
      {children}
      {isExternal && (
        <span className="ml-0.5 inline-block text-xs" aria-hidden="true">
          ↗
        </span>
      )}
    </a>
  )
}

function MdxTable({ children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full" {...props}>
        {children}
      </table>
    </div>
  )
}

export const privacyMdxComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  h2: MdxH2,
  a: MdxLink,
  table: MdxTable,
}
