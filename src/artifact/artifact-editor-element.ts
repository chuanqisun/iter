import { CodeEditorElement } from "../code-editor/code-editor-element";
import "./artifact-editor-element.css";
import { supportedArtifacts } from "./languages";
import type { ArtifactContext, ArtifactSupport } from "./languages/type";
import { copy } from "./lib/copy-button";

export interface StartEditorProps {
  trigger: HTMLElement;
  lang: string;
  code: string;
  filename?: string;
  onCodeChange?: (code: string) => void;
}

export class ArtifactEditorElement extends HTMLElement {
  static define() {
    if (customElements.get("artifact-editor-element")) return;
    customElements.define("artifact-editor-element", ArtifactEditorElement);
  }

  async start(props: StartEditorProps) {
    const abortController = new AbortController();
    const trigger = props.trigger;
    const result = Promise.withResolvers<string>();
    const dialog = this.closest("dialog")!;
    dialog.showModal();

    const editor = this.querySelector<CodeEditorElement>("code-editor-element")!;
    editor.setAttribute("data-lang", props.lang);
    editor.setAttribute("data-value", props.code);
    editor.removeAttribute("data-readonly");

    const artifact = supportedArtifacts.find((art) => art.onResolveLanguage(props.lang));
    const actionMenu = this.querySelector("#artifact-menu")!;
    const preview = this.querySelector<HTMLElement>("artifact-preview") ?? undefined;
    const nodeId = trigger?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? undefined;

    // TODO some code still depends on reaching data-node-id. We should remove this
    // and use the context object instead.
    this?.setAttribute("data-node-id", nodeId ?? "");

    const context: ArtifactContext = {
      lang: props.lang,
      code: props.code,
      filename: props.filename,
      nodeId,
      preview,
    };

    let lastRunCode: string = props.code; // We called `onRun` initially
    // editor node will be removed, no need to remove listeneres
    editor.addEventListener(
      "contentchange",
      () => {
        const latestSourceCode = editor.value;
        if (latestSourceCode === lastRunCode) return; // no change, do nothing
        lastRunCode = latestSourceCode;
        props.onCodeChange?.(latestSourceCode);
        artifact?.onRun?.({ ...context, code: latestSourceCode });
      },
      { signal: abortController.signal },
    );

    editor.addEventListener(
      "run",
      (e) => {
        const latestSourceCode = (e as CustomEvent<string>).detail;
        props.onCodeChange?.(latestSourceCode);
        artifact?.onRun?.({ ...context, code: latestSourceCode });
      },
      { signal: abortController.signal },
    );

    // first escape: exit editor focus capture, allow tab movement
    // second escape: exit edit mode
    editor.addEventListener("escape", () => editor.setAttribute("data-readonly", ""), {
      signal: abortController.signal,
    });

    editor.addEventListener("escapereadonly", () => dialog.close(), {
      signal: abortController.signal,
    });

    editor.addEventListener("enterreadonly", () => editor.removeAttribute("data-readonly"), {
      signal: abortController.signal,
    });

    editor.addEventListener(
      "mousedown",
      (_e) => {
        if (editor.hasAttribute("data-readonly")) {
          editor.removeAttribute("data-readonly");
        }
      },
      { signal: abortController.signal },
    );

    dialog.addEventListener(
      "close",
      () => {
        result.resolve(editor.value);
        if (preview) preview.innerHTML = "";
        abortController.abort();
      },
      { signal: abortController.signal },
    );

    actionMenu.addEventListener(
      "click",
      (e) => {
        const trigger = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")!;
        const action = trigger?.dataset.action ?? "";
        const code = editor.value;
        if (!artifact) return;
        this.handleArtifactAction(artifact, action, { ...context, code }, trigger);
      },
      {
        signal: abortController.signal,
      },
    );

    // kick off initial run
    if (preview) preview.innerHTML = "";
    editor.focus();
    artifact?.onRun?.(context);

    return result.promise;
  }

  private handleArtifactAction(
    artifact: ArtifactSupport,
    action: string,
    context: ArtifactContext,
    trigger: HTMLElement,
  ) {
    switch (action) {
      case "run": {
        artifact.onRun?.(context);
        return;
      }

      case "copy": {
        copy(trigger, context.code);
        return;
      }

      case "save": {
        artifact.onSave?.(context);
        return;
      }

      case "attach": {
        artifact.onAttach(context);
        return;
      }
    }
  }
}
