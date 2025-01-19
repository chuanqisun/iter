import { CodeEditorElement } from "../../code-editor/code-editor-element";
import { supportedLanguages } from "../artifact";
import type { ArtifactContext, ArtifactSupport } from "./type";

const timers = new WeakMap<Element, number>();

export class GenericArtifact implements ArtifactSupport {
  onResolveLanguage(lang: string): string | undefined {
    return supportedLanguages.includes(lang) ? lang : "text";
  }

  onCopy({ trigger, code }: ArtifactContext) {
    navigator.clipboard.writeText(code);
    trigger.classList.add("copied");
    const previousTimer = timers.get(trigger);
    if (previousTimer) clearTimeout(previousTimer);

    timers.set(
      trigger,
      window.setTimeout(() => trigger.classList.remove("copied"), 3000)
    );
  }

  onEdit({ trigger, code, lang }: ArtifactContext) {
    const artifactElement = trigger.closest("artifact-element")!;

    if (trigger.classList.contains("editing")) {
      trigger.classList.remove("editing");
      trigger.textContent = "Edit";
      const editor = artifactElement.querySelector<CodeEditorElement>("code-editor-element")!;
      const latestSourceCode = editor.value;
      const allArtifacts = [...artifactElement.parentElement!.querySelectorAll("artifact-element")];
      const index = allArtifacts.indexOf(artifactElement);
      artifactElement
        .closest(".js-message")
        ?.querySelector("code-block-events")
        ?.dispatchEvent(new CustomEvent("codeblockchange", { detail: { index, prev: code, current: latestSourceCode } }));
      editor.remove();
      return;
    } else {
      trigger.classList.add("editing");
      trigger.textContent = "View";
      const editorContainer = artifactElement.querySelector("artifact-edit")!;
      const editor = document.createElement("code-editor-element") as CodeEditorElement;
      editor.setAttribute("data-lang", lang);
      editor.setAttribute("data-value", code);
      editorContainer.appendChild(editor);

      editor.addEventListener("contentchange", () => {
        const latestSourceCode = editor.value;
        artifactElement.querySelector("artifact-source")!.textContent = latestSourceCode;
        // const isRunning = !!artifactElement.querySelector<HTMLButtonElement>(`[data-action="run"].running`);
        // TODO: push updates to live debug view
      });

      return;
    }
  }
}
