// src/hooks/useMediaQuery.ts
// Custom hook for responsive design breakpoint detection

"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is defined (client-side only)
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener for changes
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Add listener (modern browsers)
    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}
