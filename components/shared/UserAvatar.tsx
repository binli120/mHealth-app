/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

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
 * - Shows the uploaded photo when avatarUrl is a valid https://, http://, or blob: URL.
 * - Falls back to initials (first letter of first + last name) on a coloured
 *   background when no valid photo URL is available.
 * - Falls back to the default UserBadgeIcon when neither photo nor name is set.
 *
 * Note: avatarUrl must be a fully-qualified URL (https://, http://, or blob:).
 * Raw storage paths are ignored so a broken or unsigned path never overrides initials.
 * blob: URLs are accepted for immediate local previews during upload.
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
  const hasValidPhoto = Boolean(
    avatarUrl?.startsWith("https://") ||
    avatarUrl?.startsWith("http://") ||
    // blob: URLs are valid — used for immediate local previews before the signed URL is ready
    avatarUrl?.startsWith("blob:"),
  )

  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {hasValidPhoto && (
        <AvatarImage
          src={avatarUrl!}
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
