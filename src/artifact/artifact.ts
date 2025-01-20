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
          lang: supportedLanguages.includes(lang) ? lang : "text",
          theme: "dark-plus",
        });

        return `
        <artifact-element lang="${lang}" data-is-runnable="${supportedArtifacts.some((art) => !!art.onRun && art.onResolveLanguage(lang))}">
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
              ${supportedArtifacts.some((art) => art.onSave) ? `<button data-action="save">Download</button>` : ""}
            </artifact-action>
          </artifact-focus-trap-element>
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
  const action = trigger?.dataset.action;

  const artifactElement = trigger?.closest("artifact-element");
  if (!artifactElement) return;

  const code = artifactElement?.querySelector("artifact-source")?.textContent ?? "";
  const lang = artifactElement?.getAttribute("lang");
  if (!lang) return;

  const artifact = supportedArtifacts.find((art) => art.onResolveLanguage(lang));
  if (!artifact) return;

  switch (action) {
    case "edit": {
      const isEditing = trigger.classList.contains("running");
      let currentCode = code;
      const handleRerun = (e: Event) => {
        if (!artifact.onRun) return;
        const updatedCode = (e as CustomEvent<string>).detail;
        if (updatedCode === currentCode) return;
        artifact.onRun?.({ lang, code: updatedCode, trigger });
        currentCode = updatedCode;
      };

      if (isEditing) {
        artifactElement.removeEventListener("rerun", handleRerun);
        artifact.onRunExit?.({ lang, code, trigger });
        artifact.onEditExit({ lang, code, trigger });
      } else {
        artifactElement.addEventListener("rerun", handleRerun);
        artifact.onEdit({ lang, code, trigger });
        artifact.onRun?.({ lang, code, trigger });
      }
      return;
    }

    case "copy": {
      artifact.onCopy({ lang, code, trigger });
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
      display: block;
      width: 100%;
      height: 100%;
    }
  }

  artifact-element:has([data-action="edit"].running) {
    position: fixed;
    z-index: 1;
    inset: 0;

    code-editor-element {
      height: 100vh;
    }

    .cm-editor {
      padding: 0;
      border: none;
      resize: horizontal;
    }

    & .split-layout {
      position: fixed;
      inset: 0;
      display: grid;
      grid-template-columns: 1fr;
    }

    &[data-is-runnable="true"] .split-layout {
      grid-template-columns: 1fr 1fr;
    }

    /* once user has resized the editor, left pane should fit content */
    &[data-is-runnable="true"]:has(.cm-editor[style]) .split-layout {
      grid-template-columns: auto 1fr;
    }
  }

  artifact-action {
    position: absolute;
    top: 6px;
    right: 6px;

    ${artifactActionsStyles}
  }

  artifact-element:has([data-action="run"].running) {
    [data-action="edit"],
    artifact-source {
      display: none;
    }

    artifact-action [data-action="copy"] {
      display: none;
    }
  }

  artifact-element:not(:has([data-action="edit"].running)) {
    artifact-action [data-action="save"] {
      display: none;
    }
  }

  artifact-element:has([data-action="edit"].running) {
    [data-action="run"],
    artifact-source {
      display: none;
    }
  }
`;
