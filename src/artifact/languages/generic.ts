import { CodeEditorElement } from "../../code-editor/code-editor-element";
import { supportedLanguages } from "../artifact";
import { saveTextFile } from "../lib/save-text-file";
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
    const focusTrapElement = artifactElement.querySelector("artifact-focus-trap-element")!;

    trigger.classList.add("running");
    trigger.textContent = "Back";
    const editorContainer = artifactElement.querySelector("artifact-edit")!;
    const editor = document.createElement("code-editor-element") as CodeEditorElement;
    editor.setAttribute("data-lang", lang);
    editor.setAttribute("data-value", code);
    editor.setAttribute("autofocus", "");
    editorContainer.appendChild(editor);

    // editor node will be removed, no need to remove listeneres
    editor.addEventListener("contentchange", () => {
      const latestSourceCode = editor.value;
      artifactElement.querySelector("artifact-source")!.textContent = latestSourceCode;
      artifactElement.dispatchEvent(new CustomEvent("rerun", { detail: latestSourceCode }));
    });

    editor.addEventListener("run", (e) => {
      const latestSourceCode = (e as CustomEvent<string>).detail;
      artifactElement.dispatchEvent(new CustomEvent("rerun", { detail: latestSourceCode }));
    });

    // first escape: exit editor focus capture, allow tab movement
    // second escape: exit edit mode
    editor.addEventListener("escape", () => editor.setAttribute("data-readonly", ""));
    editor.addEventListener("escapereadonly", () => this.onEditExit({ trigger, code, lang }));
    editor.addEventListener("enterreadonly", () => editor.removeAttribute("data-readonly"));

    editor.addEventListener("mousedown", (_e) => {
      if (editor.hasAttribute("data-readonly")) {
        editor.removeAttribute("data-readonly");
      }
    });

    focusTrapElement.toggleAttribute("disabled", false);
  }

  onEditExit({ trigger, code }: ArtifactContext) {
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
      ?.dispatchEvent(new CustomEvent("codeblockchange", { detail: { index, prev: code, current: latestSourceCode } }));
    editor.remove();

    focusTrapElement.toggleAttribute("disabled", true);
  }

  onRunExit({ trigger }: ArtifactContext) {
    const renderContainer = trigger.closest("artifact-element")?.querySelector<HTMLElement>("artifact-preview");
    if (!renderContainer) return;

    trigger.classList.remove("running");
    renderContainer.innerHTML = "";
  }

  onSave({ lang, code }: ArtifactContext) {
    saveTextFile(`text/plain`, lang, code);
  }
}
