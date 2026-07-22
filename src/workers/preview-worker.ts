/// <reference lib="webworker" />

import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { bundledLanguages, codeToHtml } from "shiki/bundle/full";
import xss, { escapeAttrValue, whiteList } from "xss";
import { runnableArtifactLanguages } from "../artifact/languages/runnable-languages";
import { markedMathML, mathMLWhiteList } from "../markdown/math";

const supportedLanguages = Object.keys(bundledLanguages);
const editorLanguages = runnableArtifactLanguages.union(new Set(supportedLanguages));

const marked = initializeMarked();
function initializeMarked() {
  return new Marked()
    .use(
      markedShiki({
        async highlight(code, lang, props) {
          const highlightableLanguage = supportedLanguages.includes(lang) ? lang : "text";
          const editorLanguage = editorLanguages.has(lang) ? lang : "text";

          const highlightedHtml = await codeToHtml(code, {
            lang: highlightableLanguage,
            theme: "dark-plus",
          });

          const attrStr = props.join(" ");

          return `
        <artifact-element lang="${editorLanguage}" ${attrStr}>  
          <artifact-source data-state="collapsed">
            <button
              type="button"
              class="artifact-source-toggle"
              data-action="toggle-source"
              aria-label="Expand code preview"
              aria-expanded="false"
            ></button>
            ${highlightedHtml}
          </artifact-source>  
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
    )
    .use(markedMathML());
}

export async function main() {
  self.onmessage = async (event) => {
    const markdown = event.data?.markdown;
    if (markdown === undefined) return;
    const dirtyHtml = await marked.parse(markdown);

    const cleanHtml = xss(dirtyHtml, {
      whiteList: {
        ...whiteList,
        ...mathMLWhiteList,
        button: ["data-action", "class", "type", "aria-label", "aria-expanded"],
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
