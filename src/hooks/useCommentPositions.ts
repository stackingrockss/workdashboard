// src/hooks/useCommentPositions.ts
// Custom hook for calculating and tracking comment positions on the page

"use client";

import { useEffect, useState, useCallback } from "react";

export interface CommentPosition {
  commentId: string;
  top: number; // Pixels from top of document
  percentage: number; // 0-100 position in document
  isVisible: boolean; // Currently in viewport
  element: HTMLElement;
  isResolved: boolean;
  authorId: string;
}

interface UseCommentPositionsProps {
  enabled?: boolean;
}

export const useCommentPositions = ({ enabled = true }: UseCommentPositionsProps = {}) => {
  const [positions, setPositions] = useState<CommentPosition[]>([]);
  const [documentHeight, setDocumentHeight] = useState(0);

  // Calculate positions of all comment highlights on the page
  const calculatePositions = useCallback(() => {
    if (!enabled) {
      setPositions([]);
      return;
    }

    // Find all comment highlight elements
    const highlights = document.querySelectorAll<HTMLElement>('[data-comment-id]');
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    setDocumentHeight(docHeight);

    const newPositions: CommentPosition[] = [];

    highlights.forEach((element) => {
      const commentId = element.getAttribute('data-comment-id');
      const isResolved = element.getAttribute('data-resolved') === 'true';
      const authorId = element.getAttribute('data-author-id') || '';

      if (!commentId) return;

      // Get position relative to document
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const absoluteTop = rect.top + scrollTop;

      // Calculate percentage position in document
      const percentage = docHeight > 0 ? (absoluteTop / docHeight) * 100 : 0;

      // Check if element is currently visible in viewport
      const viewportHeight = window.innerHeight;
      const isVisible =
        rect.top >= 0 &&
        rect.bottom <= viewportHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth;

      newPositions.push({
        commentId,
        top: absoluteTop,
        percentage,
        isVisible,
        element,
        isResolved,
        authorId,
      });
    });

    // Sort by position (top to bottom)
    newPositions.sort((a, b) => a.top - b.top);

    setPositions(newPositions);
  }, [enabled]);

  // Set up observers and event listeners
  useEffect(() => {
    if (!enabled) return;

    // Initial calculation
    calculatePositions();

    // Debounced scroll handler
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(calculatePositions, 150);
    };

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculatePositions, 150);
    };

    // Listen for scroll and resize events
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Set up MutationObserver to detect when highlights are added/removed
    const observer = new MutationObserver((mutations) => {
      let shouldRecalculate = false;

      mutations.forEach((mutation) => {
        // Check if comment highlights were added or removed
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-comment-id')) {
            shouldRecalculate = true;
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-comment-id')) {
            shouldRecalculate = true;
          }
        });

        // Check if attributes changed on existing highlights
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          if (mutation.target.hasAttribute('data-comment-id')) {
            shouldRecalculate = true;
          }
        }
      });

      if (shouldRecalculate) {
        calculatePositions();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-comment-id', 'data-resolved', 'data-author-id'],
    });

    // Set up IntersectionObserver to track visibility more efficiently
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        // Update visibility status without full recalculation
        setPositions((prev) => {
          const updated = [...prev];
          entries.forEach((entry) => {
            const commentId = (entry.target as HTMLElement).getAttribute('data-comment-id');
            const index = updated.findIndex((p) => p.commentId === commentId);
            if (index !== -1) {
              updated[index] = {
                ...updated[index],
                isVisible: entry.isIntersecting,
              };
            }
          });
          return updated;
        });
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '0px',
      }
    );

    // Observe all current highlights
    const highlights = document.querySelectorAll<HTMLElement>('[data-comment-id]');
    highlights.forEach((highlight) => intersectionObserver.observe(highlight));

    // Cleanup
    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(resizeTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      intersectionObserver.disconnect();
    };
  }, [enabled, calculatePositions]);

  // Helper function to scroll to a specific comment
  const scrollToComment = useCallback((commentId: string) => {
    const position = positions.find((p) => p.commentId === commentId);
    if (!position) return;

    // Scroll to element with smooth behavior
    position.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    // Optionally flash the highlight
    position.element.classList.add('comment-highlight-flash');
    setTimeout(() => {
      position.element.classList.remove('comment-highlight-flash');
    }, 1000);
  }, [positions]);

  return {
    positions,
    documentHeight,
    scrollToComment,
  };
};
