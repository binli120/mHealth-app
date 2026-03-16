"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

interface UserAvatarProps {
  avatarUrl?: string | null
  firstName?: string | null
  lastName?: string | null
  size?: AvatarSize
  className?: string
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-20 text-xl",
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.trim().charAt(0).toUpperCase() ?? ""
  const l = lastName?.trim().charAt(0).toUpperCase() ?? ""
  return f + l || "?"
}

/**
 * Reusable profile avatar.
 * - Shows the uploaded photo when avatarUrl is set.
 * - Falls back to initials (first + last name) on a coloured background.
 * - Falls back to the default UserBadgeIcon (from the ui/avatar Fallback) when
 *   neither photo nor name is available.
 *
 * Use it everywhere a profile thumbnail is needed: navbar, dashboard header,
 * comments, staff views, etc.
 */
export function UserAvatar({
  avatarUrl,
  firstName,
  lastName,
  size = "sm",
  className,
}: UserAvatarProps) {
  const initials = getInitials(firstName, lastName)
  const hasInitials = initials !== "?"

  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Profile photo"}
        />
      )}
      <AvatarFallback>
        {hasInitials ? (
          <span className="font-medium leading-none">{initials}</span>
        ) : undefined /* renders default UserBadgeIcon from AvatarFallback */}
      </AvatarFallback>
    </Avatar>
  )
}
