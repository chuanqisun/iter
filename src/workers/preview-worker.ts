/// <reference lib="webworker" />

import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import xss, { escapeAttrValue, whiteList } from "xss";
import { runnableArtifactLanguages } from "../artifact/languages/runnable-languages";

const supportedLanguages = Object.keys(bundledLanguages);
const editorLanguages = runnableArtifactLanguages.union(new Set(supportedLanguages));

const markedAsync = initializeMarked();
async function initializeMarked() {
  const highlighter = await createHighlighter({
    langs: supportedLanguages,
    themes: ["dark-plus"],
  });

  const marked = await new Marked().use(
    markedShiki({
      highlight(code, lang, props) {
        const highlightableLanguage = supportedLanguages.includes(lang) ? lang : "text";
        const editorLanguage = editorLanguages.has(lang) ? lang : "text";

        const highlightedHtml = highlighter.codeToHtml(code, {
          lang: highlightableLanguage,
          theme: "dark-plus",
        });

        const attrStr = props.join(" ");

        return `
        <artifact-element lang="${editorLanguage}" ${attrStr}>  
          <artifact-source>${highlightedHtml}</artifact-source>  
            <artifact-action>
              <button data-action="edit">Edit</button>
              <button data-action="attach">Attach</button>
              <button class="copy" data-action="copy">
                <span class="ready">Copy</span>
                <span class="success">✅ Copied</span>
              </button>
              <button data-action="save">Download</button>
            </artifact-action>
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
