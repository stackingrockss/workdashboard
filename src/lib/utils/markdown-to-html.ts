/**
 * Converts markdown to HTML for clipboard copying
 * Optimized for pasting into Google Docs with proper formatting
 */

/**
 * Convert markdown text to HTML
 * Handles: headers, bold, italic, tables, lists, code blocks
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (but preserve our markdown)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers (## Header -> <h2>Header</h2>)
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic (*text* or _text_) - careful not to match bold
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");

  // Code blocks (```code```)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Tables - convert markdown tables to HTML tables
  html = convertTables(html);

  // Unordered lists (- item or * item)
  html = convertUnorderedLists(html);

  // Ordered lists (1. item)
  html = convertOrderedLists(html);

  // Horizontal rules (--- or ***)
  html = html.replace(/^[-*]{3,}$/gm, "<hr>");

  // Line breaks - convert double newlines to paragraphs
  html = convertParagraphs(html);

  return html;
}

/**
 * Convert markdown tables to HTML tables
 */
function convertTables(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = /^\|(.+)\|$/.test(line.trim());
    const isSeparator = /^\|[-:\s|]+\|$/.test(line.trim());

    if (isTableRow && !isSeparator) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else if (isSeparator && inTable) {
      // Skip separator line
      continue;
    } else {
      if (inTable) {
        // End of table, convert accumulated rows
        result.push(convertTableRowsToHtml(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }

  // Handle table at end of content
  if (inTable && tableRows.length > 0) {
    result.push(convertTableRowsToHtml(tableRows));
  }

  return result.join("\n");
}

/**
 * Convert table rows to HTML table
 */
function convertTableRowsToHtml(rows: string[]): string {
  if (rows.length === 0) return "";

  let tableHtml = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';

  rows.forEach((row, index) => {
    const cells = row
      .split("|")
      .filter((cell) => cell.trim() !== "")
      .map((cell) => cell.trim());

    if (index === 0) {
      // Header row
      tableHtml += "<thead><tr>";
      cells.forEach((cell) => {
        tableHtml += `<th style="background-color: #f3f4f6; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #d1d5db;">${cell}</th>`;
      });
      tableHtml += "</tr></thead><tbody>";
    } else {
      // Data row
      tableHtml += "<tr>";
      cells.forEach((cell) => {
        tableHtml += `<td style="padding: 8px; border: 1px solid #d1d5db;">${cell}</td>`;
      });
      tableHtml += "</tr>";
    }
  });

  tableHtml += "</tbody></table>";
  return tableHtml;
}

/**
 * Convert markdown unordered lists to HTML
 */
function convertUnorderedLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);

    if (listMatch) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${listMatch[2]}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    result.push("</ul>");
  }

  return result.join("\n");
}

/**
 * Convert markdown ordered lists to HTML
 */
function convertOrderedLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (listMatch) {
      if (!inList) {
        result.push("<ol>");
        inList = true;
      }
      result.push(`<li>${listMatch[2]}</li>`);
    } else {
      if (inList) {
        result.push("</ol>");
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    result.push("</ol>");
  }

  return result.join("\n");
}

/**
 * Convert double newlines to paragraph breaks
 */
function convertParagraphs(html: string): string {
  // Split by double newlines
  const blocks = html.split(/\n\n+/);

  return blocks
    .map((block) => {
      const trimmed = block.trim();
      // Don't wrap if it's already an HTML element
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<hr") ||
        trimmed === ""
      ) {
        return trimmed;
      }
      // Wrap plain text in paragraph tags
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");
}
