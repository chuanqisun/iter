import { useEffect } from "react";
import type { ArtifactEditorElement } from "./artifact-editor-element";
import "./artifact.css";
import { supportedArtifacts } from "./languages";
import { type ArtifactContext } from "./languages/type";
import { copy } from "./lib/copy-button";

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

  const filename = artifactElement?.getAttribute("filename") ?? undefined;

  const artifact = supportedArtifacts.find((art) => art.onResolveLanguage(lang));
  if (!artifact) return;

  const nodeId = trigger?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? undefined;
  const preview = trigger?.closest("artifact-element")?.querySelector<HTMLElement>("artifact-preview") ?? undefined;

  const actionContext: ArtifactContext = { lang, code, filename, nodeId, preview };

  switch (action) {
    case "edit": {
      document
        .querySelector<ArtifactEditorElement>("artifact-editor-element")!
        .start({
          code,
          lang,
          trigger,
        })
        .then((updatedValue) => {
          if (updatedValue === code) return; // no change, do nothing
          const allArtifacts = [...artifactElement.parentElement!.querySelectorAll("artifact-element")];
          const index = allArtifacts.indexOf(artifactElement);

          // TODO: use a more precise replacement
          // similar to codemirror's view.dispatch({ changes: { from: codeStart, to: codeEnd, insert: updatedValue } });
          artifactElement
            .closest(".js-message")
            ?.querySelector("code-block-events")
            ?.dispatchEvent(
              new CustomEvent("codeblockchange", {
                detail: { index, prev: code, current: updatedValue },
              }),
            );
        });

      return;
    }

    case "copy": {
      copy(trigger, code);
      return;
    }

    case "save": {
      artifact.onSave?.(actionContext);
      return;
    }

    case "attach": {
      artifact.onAttach(actionContext);
      return;
    }
  }
}
