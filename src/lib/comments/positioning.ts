// src/lib/comments/positioning.ts
// Pure utility functions for calculating optimal popover positions

/**
 * Represents the calculated position for a popover element
 */
export interface PopoverPosition {
  /** Which side of the highlight the popover should appear */
  side: 'right' | 'left' | 'top' | 'bottom';
  /** Absolute X position in pixels (includes scroll offset) */
  x: number;
  /** Absolute Y position in pixels (includes scroll offset) */
  y: number;
}

/**
 * Dimensions of the popover for collision detection
 */
export interface PopoverDimensions {
  /** Popover width in pixels */
  width: number;
  /** Popover height in pixels */
  height: number;
}

const VIEWPORT_PADDING = 16; // Minimum distance from viewport edge

/**
 * Calculate optimal position for popover relative to highlight element
 * Tries positions in order: right → left → below → above
 * Returns first position that fits within viewport bounds
 */
export function calculateOptimalPosition(
  highlightRect: DOMRect,
  popoverDimensions: PopoverDimensions
): PopoverPosition {
  // SSR safety check
  if (typeof window === "undefined") {
    return { side: "right", x: 0, y: 0 };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  // Try right side first (Google Docs default)
  const rightPosition = tryRightPosition(
    highlightRect,
    popoverDimensions,
    viewportWidth,
    viewportHeight,
    scrollX,
    scrollY
  );
  if (rightPosition) return rightPosition;

  // Try left side
  const leftPosition = tryLeftPosition(
    highlightRect,
    popoverDimensions,
    scrollX,
    scrollY
  );
  if (leftPosition) return leftPosition;

  // Try below
  const belowPosition = tryBelowPosition(
    highlightRect,
    popoverDimensions,
    viewportWidth,
    viewportHeight,
    scrollX,
    scrollY
  );
  if (belowPosition) return belowPosition;

  // Try above
  const abovePosition = tryAbovePosition(
    highlightRect,
    popoverDimensions,
    viewportWidth,
    scrollX,
    scrollY
  );
  if (abovePosition) return abovePosition;

  // Fallback: centered on screen (modal style)
  return {
    side: 'right',
    x: (viewportWidth - popoverDimensions.width) / 2 + scrollX,
    y: (viewportHeight - popoverDimensions.height) / 2 + scrollY,
  };
}

function tryRightPosition(
  highlightRect: DOMRect,
  popoverDimensions: PopoverDimensions,
  viewportWidth: number,
  viewportHeight: number,
  scrollX: number,
  scrollY: number
): PopoverPosition | null {
  const x = highlightRect.right + 8 + scrollX; // 8px gap
  const y = highlightRect.top + scrollY;

  // Check if fits in viewport
  if (x + popoverDimensions.width + VIEWPORT_PADDING > viewportWidth + scrollX) {
    return null;
  }

  // Adjust y if popover would go off bottom
  let adjustedY = y;
  if (y + popoverDimensions.height + VIEWPORT_PADDING > viewportHeight + scrollY) {
    adjustedY = viewportHeight + scrollY - popoverDimensions.height - VIEWPORT_PADDING;
  }

  // Ensure not off top
  if (adjustedY < scrollY + VIEWPORT_PADDING) {
    adjustedY = scrollY + VIEWPORT_PADDING;
  }

  return { side: 'right', x, y: adjustedY };
}

function tryLeftPosition(
  highlightRect: DOMRect,
  popoverDimensions: PopoverDimensions,
  scrollX: number,
  scrollY: number
): PopoverPosition | null {
  const x = highlightRect.left - popoverDimensions.width - 8 + scrollX; // 8px gap
  const y = highlightRect.top + scrollY;

  // Check if fits in viewport
  if (x < scrollX + VIEWPORT_PADDING) {
    return null;
  }

  return { side: 'left', x, y };
}

function tryBelowPosition(
  highlightRect: DOMRect,
  popoverDimensions: PopoverDimensions,
  viewportWidth: number,
  viewportHeight: number,
  scrollX: number,
  scrollY: number
): PopoverPosition | null {
  const x = highlightRect.left + scrollX;
  const y = highlightRect.bottom + 8 + scrollY; // 8px gap

  // Check if fits in viewport
  if (y + popoverDimensions.height + VIEWPORT_PADDING > viewportHeight + scrollY) {
    return null;
  }

  // Adjust x if popover would go off right edge
  let adjustedX = x;
  if (x + popoverDimensions.width + VIEWPORT_PADDING > viewportWidth + scrollX) {
    adjustedX = viewportWidth + scrollX - popoverDimensions.width - VIEWPORT_PADDING;
  }

  return { side: 'bottom', x: adjustedX, y };
}

function tryAbovePosition(
  highlightRect: DOMRect,
  popoverDimensions: PopoverDimensions,
  viewportWidth: number,
  scrollX: number,
  scrollY: number
): PopoverPosition | null {
  const x = highlightRect.left + scrollX;
  const y = highlightRect.top - popoverDimensions.height - 8 + scrollY; // 8px gap

  // Check if fits in viewport
  if (y < scrollY + VIEWPORT_PADDING) {
    return null;
  }

  // Adjust x if popover would go off right edge
  let adjustedX = x;
  if (x + popoverDimensions.width + VIEWPORT_PADDING > viewportWidth + scrollX) {
    adjustedX = viewportWidth + scrollX - popoverDimensions.width - VIEWPORT_PADDING;
  }

  return { side: 'top', x: adjustedX, y };
}

/**
 * Check if two DOM rectangles overlap
 */
export function detectOverlap(rect1: DOMRect, rect2: DOMRect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

/**
 * Calculate vertical offset for stacking overlapping popovers
 */
export function stackOverlappingPopovers(
  positions: Array<{ commentId: string; rect: DOMRect }>
): Array<{ commentId: string; offset: number }> {
  const result: Array<{ commentId: string; offset: number }> = [];
  const STACK_OFFSET = 24; // Pixels to offset each stacked popover

  positions.forEach((position, index) => {
    let offset = 0;

    // Check for overlap with previous popovers
    for (let i = 0; i < index; i++) {
      if (detectOverlap(position.rect, positions[i].rect)) {
        offset += STACK_OFFSET;
      }
    }

    result.push({
      commentId: position.commentId,
      offset,
    });
  });

  return result;
}
