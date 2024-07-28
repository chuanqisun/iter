import { createESPlayDocument } from "../lib/create-esplay-document";
import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import type { ArtifactContext } from "./type";

export class ScriptArtifact extends GenericArtifact {
  onMatchLanguage(lang: string): boolean {
    return ["typescript", "javascript", "jsx", "tsx"].includes(lang);
  }

  onRun({ trigger, code }: ArtifactContext) {
    runIframe(trigger, createESPlayDocument(code));
  }

  onSave({ code }: ArtifactContext) {
    saveTextFile("text/html", "html", createESPlayDocument(code));
  }
}
