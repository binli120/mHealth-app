/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import type { ReactNode } from "react"

interface PageIntroProps {
  /** Icon or emoji rendered inside the circle */
  icon: ReactNode
  /** Background color class for the icon circle, e.g. "bg-blue-100" */
  iconBg?: string
  title: string
  description: string
  /** Max-width for the description paragraph. Defaults to "max-lg" */
  descriptionMaxWidth?: string
}

/**
 * Centered page intro: icon circle + heading + description.
 * Used at the top of tool pages (benefit-stack, appeal-assistant, etc.)
 */
export function PageIntro({
  icon,
  iconBg = "bg-blue-100",
  title,
  description,
  descriptionMaxWidth = "max-w-lg",
}: PageIntroProps) {
  return (
    <div className="mb-8 text-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${iconBg} mb-4`}>
        {icon}
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className={`text-gray-500 mx-auto ${descriptionMaxWidth}`}>{description}</p>
    </div>
  )
}
