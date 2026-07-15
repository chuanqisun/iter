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
    this.setupColumnResizer(abortController.signal);
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

  private setupColumnResizer(signal: AbortSignal) {
    const divider = this.querySelector<HTMLElement>(".artifact-divider");
    if (!divider) return;

    let activePointerId: number | undefined;
    let pointerOffset = 0;

    const resize = (clientX: number) => {
      const bounds = this.getBoundingClientRect();
      if (bounds.width === 0) return;

      const minimumColumnWidth = Math.min(160, bounds.width / 2);
      const position = Math.min(
        bounds.width - minimumColumnWidth,
        Math.max(minimumColumnWidth, clientX - pointerOffset - bounds.left),
      );
      this.style.setProperty("--artifact-code-width", `${(position / bounds.width) * 100}%`);
    };

    const stopResizing = (pointerId = activePointerId) => {
      if (pointerId === undefined || pointerId !== activePointerId) return;

      activePointerId = undefined;
      divider.removeAttribute("data-dragging");
      this.removeAttribute("data-resizing");

      if (divider.hasPointerCapture(pointerId)) {
        divider.releasePointerCapture(pointerId);
      }
    };

    divider.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || !event.isPrimary || activePointerId !== undefined) return;

        event.preventDefault();
        activePointerId = event.pointerId;
        pointerOffset = event.clientX - divider.getBoundingClientRect().left;
        divider.setPointerCapture(event.pointerId);
        divider.setAttribute("data-dragging", "");
        this.setAttribute("data-resizing", "");
      },
      { signal },
    );

    divider.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== activePointerId) return;
        if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
          stopResizing(event.pointerId);
          return;
        }
        resize(event.clientX);
      },
      { signal },
    );

    divider.addEventListener("pointerup", (event) => stopResizing(event.pointerId), { signal });
    divider.addEventListener("pointercancel", (event) => stopResizing(event.pointerId), { signal });
    divider.addEventListener("lostpointercapture", (event) => stopResizing(event.pointerId), { signal });
    window.addEventListener("blur", () => stopResizing(), { signal });
    signal.addEventListener("abort", () => stopResizing(), { once: true });
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
