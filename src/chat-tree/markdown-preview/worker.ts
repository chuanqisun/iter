/// <reference lib="webworker" />

import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import xss, { escapeAttrValue, whiteList } from "xss";
import { mermaidLanguages, scriptingLanguages, xmlLanguages } from "../../artifact/languages/runnable-languages";

const supportedLanguages = Object.keys(bundledLanguages);
const runnableArtifactLanguages = [...scriptingLanguages, ...mermaidLanguages, ...xmlLanguages];

const markedAsync = initializeMarked();
async function initializeMarked() {
  const highlighter = await createHighlighter({
    langs: supportedLanguages,
    themes: ["dark-plus"],
  });

  const marked = await new Marked().use(
    markedShiki({
      highlight(code, lang, _props) {
        const resolvedLang = supportedLanguages.includes(lang) ? lang : "text";
        const highlightedHtml = highlighter.codeToHtml(code, {
          lang: resolvedLang,
          theme: "dark-plus",
        });

        return `
        <artifact-element lang="${resolvedLang}" data-is-runnable="${runnableArtifactLanguages.includes(resolvedLang)}">  
          <artifact-source>${highlightedHtml}</artifact-source>  
          <artifact-focus-trap-element disabled>
            <div class="split-layout">
              <artifact-edit></artifact-edit>
              <artifact-preview></artifact-preview>
            </div>
            <artifact-action>
              <button data-action="edit">Edit</button>
              <button class="copy" data-action="copy">
                <span class="ready">Copy</span>
                <span class="success">✅ Copied</span>
              </button>
              <button data-action="save">Download</button>
            </artifact-action>
          </artifact-focus-trap-element>
        </artifact-element>`;
      },
    }),
  );
  return marked;
}

export async function main() {
  self.onmessage = async (event) => {
    const markdown = event.data?.markdown;
    if (markdown === undefined) return;
    const dirtyHtml = await (await markedAsync).parse(markdown);

    const cleanHtml = xss(dirtyHtml, {
      whiteList: {
        ...whiteList,
        button: ["data-action", "class"],
        div: ["class"],
        span: ["class"],
        pre: ["class", "style"],
        ol: ["start"],
      },
      onIgnoreTag: function (tag, html, _options) {
        if (tag.startsWith("artifact-")) return html;
      },
      onIgnoreTagAttr: function (_tag, name, value, _isWhiteAttr) {
        if (name === "style") {
          // escape its value using built-in escapeAttrValue function
          return name + '="' + escapeAttrValue(value) + '"';
        }
        if (name === "tabindex") {
          return name + '="' + escapeAttrValue(value) + '"';
        }
      },
    });
    const replyPort = event.ports[0];
    replyPort.postMessage({ html: cleanHtml });
  };
}

main();
