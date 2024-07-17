import DOMPurity from "dompurify";
import * as Marked from "marked";

export function markdownToHtml(markdown: string): string {
  const dirtyHtml = Marked.parse(markdown) as string;
  const cleanHtml = DOMPurity.sanitize(dirtyHtml);
  return cleanHtml;
}
