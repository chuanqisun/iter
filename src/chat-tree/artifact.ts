import DOMPurity from "dompurify";
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { useEffect } from "react";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import { css } from "styled-components";
import { runMermaid } from "./mermaid";

const supportedLanguages = Object.keys(bundledLanguages);

async function initializeMarked() {
  const highlighter = await createHighlighter({
    langs: supportedLanguages,
    themes: ["dark-plus"],
  });

  const marked = await new Marked().use(
    markedShiki({
      highlight(code, lang, _props) {
        const highlightedHtml = highlighter.codeToHtml(code, {
          lang: supportedLanguages.includes(lang) ? lang : "text",
          theme: "dark-plus",
        });

        return `
        <artifact-element type="lang/${lang}">
          <artifact-source>${highlightedHtml}</artifact-source>  
          <artifact-preview></artifact-preview>
          <artifact-action>
            <button class="copy" data-action="copy">
              <span class="ready">Copy</span>
              <span class="success">✅ Copied</span>
            </button>
            ${
              ["mermaid", "html", "xml", "svg"].includes(lang)
                ? `<button data-action="run">
              <span class="ready">Run</span>
              <span class="running">Source</span>
              </button>`
                : ""
            }
          </artifact-action>
        </artifact-element>`;
      },
    })
  );

  return marked;
}

const markedAsync = initializeMarked();

export async function markdownToHtml(markdown: string): Promise<string> {
  const marked = await markedAsync;
  const dirtyHtml = (await marked.parse(markdown)) as string;
  const cleanHtml = DOMPurity.sanitize(dirtyHtml, {
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^artifact-.*/,
    },
  });
  return cleanHtml;
}

export function useArtifactActions() {
  useEffect(() => {
    window?.addEventListener("click", handleArtifactActions);

    return () => {
      window?.removeEventListener("click", handleArtifactActions);
    };
  }, []);
}

const timers = new WeakMap<Element, number>();
export function handleArtifactActions(event: MouseEvent) {
  const trigger = (event.target as HTMLElement).closest(`artifact-action [data-action]`) as HTMLElement;
  const code = trigger?.closest("artifact-element")?.querySelector("artifact-source")?.textContent ?? undefined;
  const action = trigger?.dataset.action;

  switch (action) {
    case "copy": {
      if (code) {
        navigator.clipboard.writeText(code);
        trigger.classList.add("copied");
        const previousTimer = timers.get(trigger);
        if (previousTimer) clearTimeout(previousTimer);

        timers.set(
          trigger,
          setTimeout(() => trigger.classList.remove("copied"), 3000)
        );
      }
      return;
    }

    case "run": {
      const type = trigger?.closest("artifact-element")?.getAttribute("type");
      if (!type) return;

      if (type === "lang/mermaid") runMermaid(trigger, code);
      if (["lang/html", "lang/xml", "lang/svg"].includes(type)) runIframe(trigger, code);
      return;
    }
  }
}

function runIframe(trigger: HTMLElement, code?: string) {
  if (!code) return;

  const renderContainer = trigger.closest("artifact-element")?.querySelector("artifact-preview");
  if (!renderContainer) return;

  if (trigger.classList.contains("running")) {
    trigger.classList.remove("running");
    renderContainer.innerHTML = "";
  } else {
    trigger.classList.add("running");
    const iframe = document.createElement("iframe");
    iframe.srcdoc = code;
    iframe.frameBorder = "0";
    // resize onload
    iframe.onload = (e) => {
      const iframe = e.target as HTMLIFrameElement;
      const calculatedHeight = Math.max(iframe.contentWindow?.document.documentElement.scrollHeight ?? 320, 320);
      iframe.style.height = `${calculatedHeight}px`;
    };
    renderContainer.innerHTML = "";
    renderContainer.appendChild(iframe);
  }
}

const artifactActionsStyles = css`
  button {
    font-size: 12px;
    padding: 0 4px;

    opacity: 0.725;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }
  }

  [data-action="copy"] {
    &:not(.copied) {
      .success {
        display: none;
      }
    }
    &.copied {
      opacity: 1;
      .ready {
        display: none;
      }
    }
  }

  [data-action="run"] {
    &:not(.running) {
      .running {
        display: none;
      }
    }

    &.running {
      .ready {
        display: none;
      }
    }
  }
`;

export const artifactStyles = css`
  artifact-element {
    display: block;
    position: relative;
  }

  artifact-preview {
    display: block;

    &:has(svg) {
      display: grid;
      justify-content: center;
      background-color: white;
    }

    iframe {
      width: 100%;
      resize: vertical;
    }
  }

  artifact-action {
    position: absolute;
    top: 6px;
    right: 6px;

    ${artifactActionsStyles}
  }

  artifact-element:has([data-action="run"].running) {
    artifact-source {
      display: none;
    }

    artifact-action [data-action="copy"] {
      display: none;
    }
  }
`;
