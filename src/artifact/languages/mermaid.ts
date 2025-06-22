import { runMermaid } from "../lib/run-mermaid";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { mermaidLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

export class MermaidArtifact extends GenericArtifact {
  onResolveLanguage(lang: string) {
    return mermaidLanguages.includes(lang) ? "mermaid" : undefined;
  }

  onRun({ preview, code }: ArtifactContext) {
    runMermaid(preview, code);
  }

  onSave({ preview }: ArtifactContext) {
    if (!preview) return;
    saveTextFile("image/svg+xml", "svg", preview.innerHTML);
  }
}
