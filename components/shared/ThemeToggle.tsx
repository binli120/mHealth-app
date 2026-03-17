"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

// Returns true only on the client — avoids hydration mismatch without useEffect+setState
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useIsMounted()

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled className="opacity-0" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-200" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-200" />
      )}
    </Button>
  )
}
