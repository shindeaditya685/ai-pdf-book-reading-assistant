"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * Sonner toaster.
 *
 * UI fix (U1): previously this used `useTheme()` from next-themes, but the
 * app never mounts a <ThemeProvider> (it uses a custom localStorage + html
 * class system). As a result `useTheme()` always returned "system" and
 * toasts were themed incorrectly. We now read the theme directly from the
 * <html> class list, which the inline script in layout.tsx keeps in sync.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("dark")

  useEffect(() => {
    const sync = () => {
      const isDark = document.documentElement.classList.contains("dark")
      setTheme(isDark ? "dark" : "light")
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
