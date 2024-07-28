import DOMPurity from "dompurify";
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { useEffect } from "react";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import { css } from "styled-components";
import { GenericArtifact } from "./languages/generic";
import { MermaidArtifact } from "./languages/mermaid";
import { ScriptArtifact } from "./languages/script";
import { type ArtifactSupport } from "./languages/type";
import { XmlArtifact } from "./languages/xml";

export const supportedLanguages = Object.keys(bundledLanguages);

const supportedArtifacts: ArtifactSupport[] = [new ScriptArtifact(), new XmlArtifact(), new MermaidArtifact(), new GenericArtifact()];

async function initializeMarked() {
  const highlighter = await createHighlighter({
    langs: supportedLanguages,
    themes: ["dark-plus"],
  });

  const marked = await new Marked().use(
    markedShiki({
      highlight(code, lang, _props) {
        const highlightedHtml = highlighter.codeToHtml(code, {
          lang: supportedArtifacts.find((art) => art.onResolveLanguage(lang))?.onResolveLanguage(lang) ?? "text",
          theme: "dark-plus",
        });

        return `
        <artifact-element lang="${lang}">
          <artifact-source>${highlightedHtml}</artifact-source>  
          <artifact-preview></artifact-preview>
          <artifact-action>
            ${
              supportedArtifacts.some((art) => !!art.onRun && art.onResolveLanguage(lang))
                ? `
                <button data-action="run">
                  <span class="ready">Run</span>
                  <span class="running">Stop</span>
                </button>
                ${supportedArtifacts.some((art) => art.onSave) ? `<button data-action="save">Save</button>` : ""}
              `
                : ""
            }
            <button class="copy" data-action="copy">
              <span class="ready">Copy</span>
              <span class="success">✅ Copied</span>
            </button>
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

export function handleArtifactActions(event: MouseEvent) {
  const trigger = (event.target as HTMLElement).closest(`artifact-action [data-action]`) as HTMLElement;
  const code = trigger?.closest("artifact-element")?.querySelector("artifact-source")?.textContent ?? "";
  const action = trigger?.dataset.action;
  const lang = trigger?.closest("artifact-element")?.getAttribute("lang");
  if (!lang) return;
  const artifact = supportedArtifacts.find((art) => art.onResolveLanguage(lang));
  if (!artifact) return;

  switch (action) {
    case "copy": {
      artifact.onCopy({ lang, code, trigger });
      return;
    }

    case "run": {
      artifact.onRun?.({ lang, code, trigger });
      return;
    }

    case "save": {
      artifact.onSave?.({ lang, code, trigger });
      return;
    }
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
    background-color: white;

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

  artifact-element:not(:has([data-action="run"].running)) {
    artifact-action [data-action="save"] {
      display: none;
    }
  }
`;
