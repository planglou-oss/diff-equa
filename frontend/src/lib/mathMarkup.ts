// Keep comparisons/alignment inside LaTeX as text before parsing HTML.
// Existing entities are preserved so applying this at both rendering stages is safe.
export function protectMathMarkup(html: string) {
  return html.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (math) =>
    math
      .replace(/&(?!#\d+;|#x[0-9a-f]+;|[a-z]+;)/gi, "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
  );
}
