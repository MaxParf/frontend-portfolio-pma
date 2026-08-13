/**
 * Keeps author text plain while turning blank-line boundaries into semantic paragraphs.
 * A single authored line break remains part of the same sentence for both renderers.
 */
export function splitPlainTextParagraphs(value) {
  if (typeof value !== "string") return [];
  return value.replace(/\r\n?/g, "\n").split(/\n[\t ]*\n+/).map((paragraph) => paragraph.trim().replace(/[\t ]*\n[\t ]*/g, " ")).filter(Boolean);
}
