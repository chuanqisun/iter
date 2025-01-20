import DOMPurity from "dompurify";
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { useEffect } from "react";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import { GenericArtifact } from "./languages/generic";
import { MermaidArtifact } from "./languages/mermaid";
import { ScriptArtifact } from "./languages/script";
import { type ArtifactSupport } from "./languages/type";
import { XmlArtifact } from "./languages/xml";

import "./artifact.css";

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

        const matchingArtifact = supportedArtifacts.find((art) => art.onResolveLanguage(lang));

        return `
        <artifact-element lang="${lang}" data-is-runnable="${!!matchingArtifact?.onRun}">
          <artifact-source>${highlightedHtml}</artifact-source>  
          <artifact-focus-trap-element disabled>
            <dialog class="split-layout">
              <artifact-edit></artifact-edit>
              <artifact-preview></artifact-preview>
            </dialog>
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
        artifactElement.querySelector("dialog")?.showModal();
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
