// src/lib/text-selection.ts
// Utilities for handling text selection and converting to/from selectors

export interface TextSelection {
  selectionType: "text" | "element";
  anchorSelector: string;
  anchorOffset: number;
  focusSelector: string;
  focusOffset: number;
  selectedText: string;
}

/**
 * Get CSS selector path for an element
 */
function getElementSelector(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add ID if available
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }

    // Add class if available
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += `.${classes.join(".")}`;
      }
    }

    // Add nth-child if needed for uniqueness
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current);
      if (siblings.length > 1) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

/**
 * Capture the current text selection and convert to selectors
 */
export function captureTextSelection(): TextSelection | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();

  if (!selectedText || selectedText.length === 0) {
    return null;
  }

  // Limit selected text length
  if (selectedText.length > 5000) {
    console.warn("Selected text too long, truncating to 5000 characters");
  }

  // Get anchor (start) and focus (end) containers
  const anchorNode = range.startContainer;
  const focusNode = range.endContainer;

  // Get parent elements (text nodes don't have selectors)
  const anchorElement =
    anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : (anchorNode as Element);

  const focusElement =
    focusNode.nodeType === Node.TEXT_NODE
      ? focusNode.parentElement
      : (focusNode as Element);

  if (!anchorElement || !focusElement) {
    console.error("Could not find parent elements for selection");
    return null;
  }

  try {
    return {
      selectionType: "text",
      anchorSelector: getElementSelector(anchorElement),
      anchorOffset: range.startOffset,
      focusSelector: getElementSelector(focusElement),
      focusOffset: range.endOffset,
      selectedText: selectedText.substring(0, 5000),
    };
  } catch (error) {
    console.error("Error capturing text selection:", error);
    return null;
  }
}

/**
 * Restore a text selection from selectors
 */
export function restoreTextSelection(selection: TextSelection): Range | null {
  try {
    // Find elements using selectors
    const anchorElement = document.querySelector(selection.anchorSelector);
    const focusElement = document.querySelector(selection.focusSelector);

    if (!anchorElement || !focusElement) {
      console.warn("Could not find elements for selection", {
        anchorSelector: selection.anchorSelector,
        focusSelector: selection.focusSelector,
      });
      return null;
    }

    // Find text nodes within elements
    const getTextNode = (element: Element, offset: number): { node: Node; offset: number } | null => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let currentOffset = 0;
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const textLength = node.textContent?.length || 0;
        if (currentOffset + textLength >= offset) {
          return {
            node,
            offset: offset - currentOffset,
          };
        }
        currentOffset += textLength;
      }

      // Fallback: return first text node
      return element.firstChild ? { node: element.firstChild, offset: 0 } : null;
    };

    const anchorInfo = getTextNode(anchorElement, selection.anchorOffset);
    const focusInfo = getTextNode(focusElement, selection.focusOffset);

    if (!anchorInfo || !focusInfo) {
      console.warn("Could not find text nodes for selection");
      return null;
    }

    // Create range
    const range = document.createRange();
    range.setStart(anchorInfo.node, Math.min(anchorInfo.offset, anchorInfo.node.textContent?.length || 0));
    range.setEnd(focusInfo.node, Math.min(focusInfo.offset, focusInfo.node.textContent?.length || 0));

    // Verify text matches (fuzzy match)
    const rangeText = range.toString().trim();
    const expectedText = selection.selectedText.trim();

    if (rangeText !== expectedText) {
      console.warn("Selected text doesn't match exactly", {
        expected: expectedText,
        actual: rangeText,
      });

      // Try fuzzy matching (allow small differences)
      const similarity = calculateSimilarity(rangeText, expectedText);
      if (similarity < 0.8) {
        console.error("Text selection has changed too much, cannot restore");
        return null;
      }
    }

    return range;
  } catch (error) {
    console.error("Error restoring text selection:", error);
    return null;
  }
}

/**
 * Calculate similarity between two strings (simple Levenshtein distance)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Highlight a range with a specific color and click handler
 */
export function highlightRange(
  range: Range,
  options: {
    color?: string;
    onClick?: (element: HTMLElement) => void;
    className?: string;
    commentId?: string;
    isResolved?: boolean;
    authorId?: string;
  } = {}
): HTMLElement[] {
  const {
    color = "#ffeb3b",
    onClick,
    className = "comment-highlight",
    commentId,
    isResolved,
    authorId,
  } = options;

  const highlights: HTMLElement[] = [];

  try {
    // Create a document fragment to hold the highlighted content
    const fragment = range.extractContents();

    // Wrap text nodes in highlight spans
    const wrapper = document.createElement("span");
    wrapper.className = className;
    wrapper.style.backgroundColor = color;
    wrapper.style.cursor = onClick ? "pointer" : "default";
    wrapper.style.transition = "background-color 0.2s";

    // Add data attributes for position tracking
    if (commentId) {
      wrapper.setAttribute("data-comment-id", commentId);
    }
    if (isResolved !== undefined) {
      wrapper.setAttribute("data-resolved", String(isResolved));
    }
    if (authorId) {
      wrapper.setAttribute("data-author-id", authorId);
    }

    if (onClick) {
      wrapper.addEventListener("click", () => onClick(wrapper));
      wrapper.addEventListener("mouseenter", () => {
        wrapper.style.backgroundColor = darkenColor(color, 0.1);
      });
      wrapper.addEventListener("mouseleave", () => {
        wrapper.style.backgroundColor = color;
      });
    }

    wrapper.appendChild(fragment);
    range.insertNode(wrapper);

    highlights.push(wrapper);
  } catch (error) {
    console.error("Error highlighting range:", error);
  }

  return highlights;
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent * 100);
  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;

  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * Remove all highlights from the document
 */
export function clearAllHighlights(className = "comment-highlight"): void {
  const highlights = document.querySelectorAll(`.${className}`);
  highlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    if (parent) {
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
    }
  });
}
