import { runMermaid } from "../lib/run-mermaid";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import type { ArtifactContext } from "./type";

export class MermaidArtifact extends GenericArtifact {
  onMatchLanguage(lang: string) {
    return ["mermaid", "mmd"].includes(lang);
  }

  onRun({ trigger, code }: ArtifactContext) {
    runMermaid(trigger, code);
  }

  onSave({ trigger }: ArtifactContext) {
    const preview = trigger?.closest("artifact-element")?.querySelector("artifact-preview");
    if (!preview) return;
    saveTextFile("image/svg+xml", "svg", preview.innerHTML);
  }
}
