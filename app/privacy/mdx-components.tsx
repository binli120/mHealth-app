/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { AnchorHTMLAttributes, HTMLAttributes } from "react"

function MdxH2({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 id={id} className="scroll-mt-24 group mt-12 first:mt-0 text-3xl font-bold underline" {...props}>
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 no-underline"
          aria-label={`Link to ${typeof children === "string" ? children : "section"}`}
        >
          #
        </a>
      )}
    </h2>
  )
}

function MdxH3({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className="mt-8 mb-3 text-2xl font-semibold underline" {...props}>
      {children}
    </h3>
  )
}

function MdxParagraph({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className="mb-4" {...props}>
      {children}
    </p>
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
      <table className="w-full border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2" {...props}>
        {children}
      </table>
    </div>
  )
}

export const privacyMdxComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  h2: MdxH2,
  h3: MdxH3,
  p: MdxParagraph,
  a: MdxLink,
  table: MdxTable,
}
