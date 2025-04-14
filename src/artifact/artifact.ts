import DOMPurity from "dompurify";
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import { useEffect } from "react";
import { bundledLanguages, createHighlighter } from "shiki/bundle/web";
import { GenericArtifact } from "./languages/generic";
import { MermaidArtifact } from "./languages/mermaid";
import { ScriptArtifact } from "./languages/script";
import { type ArtifactContext, type ArtifactSupport } from "./languages/type";
import { XmlArtifact } from "./languages/xml";

import type { CodeEditorElement } from "../code-editor/code-editor-element";
import "./artifact.css";

export const supportedLanguages = Object.keys(bundledLanguages);

const supportedArtifacts: ArtifactSupport[] = [
  new ScriptArtifact(),
  new XmlArtifact(),
  new MermaidArtifact(),
  new GenericArtifact(),
];

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
            <div  class="split-layout">
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
        onRunExit?.({ lang, code, trigger });
        onEditExit({ lang, code, trigger });
      } else {
        artifactElement.querySelector("dialog")?.showModal();
        artifactElement.addEventListener("rerun", handleRerun);
        onEdit({ lang, code, trigger });
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

function onEdit({ trigger, code, lang }: ArtifactContext) {
  const currentFocus = document.activeElement?.closest(".js-focusable");
  const artifactElement = trigger.closest("artifact-element")!;
  const focusTrapElement = artifactElement.querySelector("artifact-focus-trap-element")!;

  trigger.classList.add("running");
  trigger.textContent = "Back";
  const editorContainer = artifactElement.querySelector("artifact-edit")!;
  const editor = document.createElement("code-editor-element") as CodeEditorElement;
  editor.setAttribute("data-lang", lang);
  editor.setAttribute("data-value", code);
  editor.setAttribute("data-autofocus", "");
  editorContainer.appendChild(editor);
  (editor as any).returnFocus = () => (currentFocus as HTMLElement)?.focus?.();

  // editor node will be removed, no need to remove listeneres
  editor.addEventListener("contentchange", () => {
    const latestSourceCode = editor.value;
    // artifactElement.querySelector("artifact-source")!.textContent = latestSourceCode;
    artifactElement.dispatchEvent(new CustomEvent("rerun", { detail: latestSourceCode }));
  });

  editor.addEventListener("run", (e) => {
    const latestSourceCode = (e as CustomEvent<string>).detail;
    artifactElement.dispatchEvent(new CustomEvent("rerun", { detail: latestSourceCode }));
  });

  // first escape: exit editor focus capture, allow tab movement
  // second escape: exit edit mode
  editor.addEventListener("escape", () => editor.setAttribute("data-readonly", ""));
  editor.addEventListener("escapereadonly", () => onEditExit({ trigger, code, lang }));
  editor.addEventListener("enterreadonly", () => editor.removeAttribute("data-readonly"));

  editor.addEventListener("mousedown", (_e) => {
    if (editor.hasAttribute("data-readonly")) {
      editor.removeAttribute("data-readonly");
    }
  });

  focusTrapElement.toggleAttribute("disabled", false);
}

function onEditExit({ trigger, code }: ArtifactContext) {
  const artifactElement = trigger.closest("artifact-element")!;
  const focusTrapElement = artifactElement.querySelector("artifact-focus-trap-element")!;

  trigger.classList.remove("running");
  trigger.textContent = "Edit";
  const editor = artifactElement.querySelector<CodeEditorElement>("code-editor-element")!;
  const latestSourceCode = editor.value;
  const allArtifacts = [...artifactElement.parentElement!.querySelectorAll("artifact-element")];
  const index = allArtifacts.indexOf(artifactElement);
  artifactElement
    .closest(".js-message")
    ?.querySelector("code-block-events")
    ?.dispatchEvent(
      new CustomEvent("codeblockchange", {
        detail: { index, prev: code, current: latestSourceCode },
      }),
    );

  (editor as any).returnFocus?.();
  editor.remove();

  focusTrapElement.toggleAttribute("disabled", true);
}

function onRunExit({ trigger }: ArtifactContext) {
  const renderContainer = trigger.closest("artifact-element")?.querySelector<HTMLElement>("artifact-preview");
  if (!renderContainer) return;

  trigger.classList.remove("running");
  renderContainer.innerHTML = "";
}
