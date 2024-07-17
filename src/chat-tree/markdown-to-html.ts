import DOMPurity from "dompurify";
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import { addCopyButton } from "./copy-code-block";

const supportedLanguages = Object.keys(bundledLanguages);

async function initializeMarked() {
  const highlighter = await createHighlighter({
    langs: supportedLanguages,
    themes: ["dark-plus"],
  });

  const marked = await new Marked().use(
    markedShiki({
      highlight(code, lang, _props) {
        return highlighter.codeToHtml(code, { transformers: [addCopyButton()], lang: supportedLanguages.includes(lang) ? lang : "text", theme: "dark-plus" });
      },
    })
  );

  return marked;
}

const markedAsync = initializeMarked();

export async function markdownToHtml(markdown: string): Promise<string> {
  const marked = await markedAsync;
  const dirtyHtml = (await marked.parse(markdown)) as string;
  const cleanHtml = DOMPurity.sanitize(dirtyHtml);
  return cleanHtml;
}
